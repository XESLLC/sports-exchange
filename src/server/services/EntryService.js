const User = require('../models/User');
const UserEntry = require('../models/UserEntry');
const Entry = require('../models/Entry');
const TournamentTeam = require('../models/TournamentTeam');
const StockEntry = require('../models/StockEntry');
const Team = require('../models/Team');
const Stock = require('../models/Stock');
const EntryBid = require('../models/EntryBid');
const instance = require('../models/SequelizeInstance');
const Transaction = require('../models/Transaction');
const { Op } = require('sequelize');
const Tournament = require('../models/Tournament');
const { v4: uuidv4 } = require('uuid');
const {sendEmail} = require ('../util/sendEmail');
const fs = require ('fs')
const { assertTournamentTradingOpen, assertTournamentAcceptingNewEntries } = require('../util/tournamentStatus');

const EntryService = {
  createEntry: async (name, userEmails, tournamentId) => {
    const tournament = await Tournament.findByPk(tournamentId);
    assertTournamentAcceptingNewEntries(tournament);

    const users = await User.findAll({
      where: {
        email: userEmails
      }
    });
    if(!users || users.length < 1) {
      throw new Error("users not found");
    }

    // Every requested owner email needs an existing account - fail loudly
    // and name the culprits, rather than silently creating the entry with
    // only whichever emails happened to match (e.g. a typo in a co-owner's
    // email used to be dropped without any indication).
    const foundEmails = users.map(user => user.email);
    const missingEmails = userEmails.filter(email => !foundEmails.includes(email));
    if(missingEmails.length > 0) {
      throw new Error(`No account found for: ${missingEmails.join(', ')} - they need to sign up first, then can be added as an owner.`);
    }

    const entry = await Entry.create({
      tournamentId,
      name,
      ipoCashSpent: 0,
      secondaryMarketCashSpent: 0,
      secondaryMarketCashIncome: 0
    });

    for(let user of users) {
      await UserEntry.create({
        userId: user.id,
        entryId: entry.id
      });
    }

    return entry;
  },
  createEntryBid: async (entryId, tournamentTeamId, price, quantity, expiresAt) => {
    console.log("create entry bid")
    const result = await instance.transaction(async (t) => {
      const entry = await Entry.findOne({
        where: {
          id: entryId
        },
        transaction: t
      });
      if(!entry) {
        throw new Error("entry not found");
      }

      const tournament = await Tournament.findByPk(entry.tournamentId, {transaction: t});
      assertTournamentTradingOpen(tournament);

      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId, {transaction: t});
      if(!tournamentTeam) {
        throw new Error("tournament team not found");
      }

      const team = await Team.findByPk(tournamentTeam.teamId, {transaction: t});
      if(!team) {
        throw new Error("team not found");
      }

      const entryBid = await EntryBid.create({
        entryId,
        tournamentTeamId,
        price,
        quantity,
        expiresAt
      }, {transaction: t});

      // check for and execute matched trades
      // search for stocks available that i do not own
      const tournamentTeamStocks = await Stock.findAll({
        where: {
          tournamentTeamId
        },
        transaction: t
      });
      // this is a hack because [Op.lte] is not working correctly
      const matchedStocks = tournamentTeamStocks.filter(stock => stock.price <= price && stock.price !== null);
      const matchedStockIds = matchedStocks.map(stock => stock.id);

      const matchedStockEntries = await StockEntry.findAll({
        where: {
          stockId: matchedStockIds
        },
        transaction: t
      });

      const availableStocks = matchedStockEntries.filter(stock => stock.entryId !== entryId);
      const iteratorVal = Math.min(availableStocks.length, quantity);
      let trades = [];
      let entryStockQuantityObj = {};
      for(let stock of availableStocks) {
        const currentQuantityOfStocks = Object.keys(entryStockQuantityObj).reduce((result, entryId) => {
          return result += entryStockQuantityObj[entryId];
        }, 0);

        if(currentQuantityOfStocks < iteratorVal) {
          if(!entryStockQuantityObj[stock.entryId]) {
            entryStockQuantityObj[stock.entryId] = 1;
          } else {
            if(entryStockQuantityObj[stock.entryId] + 1 <= iteratorVal) {
              entryStockQuantityObj[stock.entryId] += 1;
            }
          }
        }
      }

      for(const sellerEntryId in entryStockQuantityObj) {
        const sellerEntry = await Entry.findOne({
          where: {
            id: sellerEntryId
          },
          transaction: t
        });
        if(!sellerEntry) {
          throw new Error("Entry for seller not found");
        }

        sellerEntry.secondaryMarketCashIncome += (price * entryStockQuantityObj[sellerEntryId]);
        await sellerEntry.save({transaction: t});
        entry.secondaryMarketCashSpent += (price * entryStockQuantityObj[sellerEntryId]);
        await entry.save({transaction: t});
      }

      const transactionGroupId = uuidv4();
      let transactionCounter = 0;
      let sellerEntryForEmail;
      let amountPerShare;
      for(let i = 0; i < iteratorVal; i++) {
        // set up transaction in case any of this shit fails
        // capture the current stockentry entryId in order to credit the entry with cash later
        // set the stockentry entryId to entryId
        // get Stock where id === stockentry.stockId, capture the current price in order to decrement/increase cash to entries later
        // set the stock price to null
        // credit the captured entry with the captured price
        // decrement entryId with the captured price
        // create two new transaction records in the db for seller and buyer, negative cash amount for seller
        // return the transaction as a decorated object
        const stockEntryToTrade = availableStocks[i];
        const sellerEntry = await Entry.findOne({
          where: {
            id: stockEntryToTrade.entryId
          },
          transaction: t
        });
        if(!sellerEntry) {
          throw new Error("Entry for seller not found");
        }
        sellerEntryForEmail = JSON.parse(JSON.stringify(sellerEntry));
        stockEntryToTrade.entryId = entryId;
        await stockEntryToTrade.save({transaction: t});

        const stockToTrade = await Stock.findOne({
          where: {
            id: stockEntryToTrade.stockId
          },
          transaction: t
        });
        if(!stockToTrade) {
          throw new Error("Stock to trade not found");
        }
        const tradePrice = stockToTrade.price;
        amountPerShare = stockToTrade.price;
        stockToTrade.price = null;
        await stockToTrade.save({transaction: t});

        const sellerTransaction = await Transaction.create({
          entryId: sellerEntry.id,
          stockId: stockToTrade.id,
          quantity: 1,
          cost: (tradePrice * -1),
          groupId: transactionGroupId
        }, {transaction: t});

        const buyerTransaction = await Transaction.create({
          entryId,
          stockId: stockToTrade.id,
          quantity: 1,
          cost: tradePrice,
          groupId: transactionGroupId
        }, {transaction: t});

        trades.push({
          ...sellerTransaction.toJSON(),
          teamName: team.name,
          tournamentTeamId,
        });

        trades.push({
          ...buyerTransaction.toJSON(),
          teamName: team.name,
          tournamentTeamId,
        });

        transactionCounter += 1;
      }

      if(transactionCounter > 0) {
        const plural = transactionCounter > 1 ? 's' : '';
        const sellerMessage = `You sold ${transactionCounter} share${plural} of ${team.name} to ${entry.name} for $${amountPerShare} per share`;
        const buyerMessage = `You bought ${transactionCounter} share${plural} of ${team.name} from ${sellerEntryForEmail.name} for $${amountPerShare} per share`;

        const userEntries = await UserEntry.findAll({
          where: {
            entryId: sellerEntryForEmail.id
          },
          transaction: t
        });

        const userIds = userEntries.map(userEntry => userEntry.userId);

        const users = await User.findAll({
          where: {
            id: userIds
          },
          transaction: t
        });

        const sellerEmailAddressToSendTradeNotification = users.map(user => user.email);

        for(let email of sellerEmailAddressToSendTradeNotification) {
          await sendEmail(email, 'Trade Notification', sellerMessage);
        }

        const buyerEntries = await UserEntry.findAll({
          where: {
            entryId
          },
          transaction: t
        });

        const buyerUserIds = buyerEntries.map(userEntry => userEntry.userId);

        const buyerUsers = await User.findAll({
          where: {
            id: buyerUserIds
          },
          transaction: t
        });

        const buyerEmailAddressToSendTradeNotification = buyerUsers.map(user => user.email);

        for(let email of buyerEmailAddressToSendTradeNotification) {
          await sendEmail(email, 'Trade Notification', buyerMessage)
        }
      }

      if(iteratorVal === entryBid.quantity) {
        await entryBid.destroy({transaction: t});
      } else {
        entryBid.quantity -= iteratorVal;
        await entryBid.save({transaction: t});
      }

      return {
        id: entryBid.id,
        entryId: entryBid.entryId,
        tournamentTeamId: entryBid.tournamentTeamId,
        price: entryBid.price,
        quantity: entryBid.quantity,
        teamName: team.name,
        trades
      }
    });

    return result;
  },
  entry: async (id) => {
    const entry = await Entry.findOne({
      where: {
        id
      }
    });

    return entry;
  },
  entriesByTournamentId: async (tournamentId) => {
    const entries = await Entry.findAll({
      where: {
        tournamentId
      }
    });

    return entries;
  },
  deleteEntryBid: async (id) => {
    const entryBid = await EntryBid.findOne({
      where: {
        id
      }
    });

    const entry = await Entry.findOne({
      where: {
        id: entryBid.entryId
      }
    });

    await entryBid.destroy();

    return entry;
  },
  getBidsForEntry: async (entryId) => {
    const entry = await Entry.findByPk(entryId);
    if(!entry) {
      throw new Error(`Entry for id: ${entryId} not found`);
    }

    const tournamentTeams = await TournamentTeam.findAll({
      where: {
        tournamentId: entry.tournamentId
      }
    });
    const tournamentTeamIds = tournamentTeams.map(tournamentTeam => tournamentTeam.id);

    const tournamentBids = await EntryBid.findAll({
      where: {
        tournamentTeamId: tournamentTeamIds
      }
    });

    const myTournamentBids = tournamentBids.filter(bid => bid.entryId === entryId);
    const leagueTournamentBids = tournamentBids.filter(bid => bid.entryId !== entryId);

    const myBids = await Promise.all(
      myTournamentBids.map(async(entryBid) => {
        const tournamentTeam = await TournamentTeam.findByPk(entryBid.tournamentTeamId);
        if(!tournamentTeam) {
          throw new Error("tournament team not found");
        }

        const team = await Team.findByPk(tournamentTeam.teamId);
        if(!team) {
          throw new Error("team not found");
        }

        return {
          ...entryBid.toJSON(),
          teamName: team.name
        }
      })
    );
    const leagueBids = await Promise.all(
      leagueTournamentBids.map(async(entryBid) => {
        const tournamentTeam = await TournamentTeam.findByPk(entryBid.tournamentTeamId);
        if(!tournamentTeam) {
          throw new Error("tournament team not found");
        }

        const team = await Team.findByPk(tournamentTeam.teamId);
        if(!team) {
          throw new Error("team not found");
        }

        return {
          ...entryBid.toJSON(),
          teamName: team.name
        }
      })
    );

    return {
      myBids,
      leagueBids
    }
  },
  ipoPurchase: async (tournamentTeamId, quantity, userEmail, entryId) => {
    const result = await instance.transaction(async (t) => {
      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId, {transaction: t});
      if(!tournamentTeam) {
        throw new Error("Tournament team not found");
      }

      const tournament = await Tournament.findOne({
        where: {
          id: tournamentTeam.tournamentId
        },
        transaction: t
      });
      if(!tournament) {
        throw new Error("Tournament not found");
      }

      if(tournament.isIpoOpen === false) {
        throw new Error("IPO purchasing window is closed");
      }
      assertTournamentTradingOpen(tournament);

      const entry = await Entry.findOne({
        where: {
          id: entryId
        },
        transaction: t
      });
      if(!entry) {
        throw new Error("Entry not found");
      }

      const user = await User.findOne({
        where: {
          email: userEmail
        },
        transaction: t
      });
      if(!user) {
        throw new Error("User not found");
      }

      const adminEmails = ["couvillion@gmail.com", "david.xesllc@gmail.com", "bartsched@gmail.com"];

      if(!adminEmails.includes(user.email)) {
        const userEntry = await UserEntry.findOne({
          where: {
            entryId: entry.id,
            userId: user.id
          },
          transaction: t
        });
        if(!userEntry) {
          throw new Error("Not authorized for entry ipo purchase");
        }
      }

      const ipoPrice = tournamentTeam.price
      const team = await Team.findByPk(tournamentTeam.teamId, {transaction: t})
      const totalPrice = ipoPrice * quantity;

      entry.ipoCashSpent += totalPrice;
      await entry.save({transaction: t});

      let stocksList = [];
      for(let i = 0; i < quantity; i++) {
        stocksList.push({
          price: null,
          tournamentTeamId,
          originalIpoEntryId: entryId
        });
      }

      const createdStocks = await Stock.bulkCreate(stocksList, {transaction: t});
      const stockEntriesList = createdStocks.map((stock) => {
        return {
          entryId: entry.id,
          stockId: stock.id
        }
      });
      await StockEntry.bulkCreate(stockEntriesList, {transaction: t});

      return {
        ipoPrice,
        quantity,
        teamName: team.name
      };
    });

    return result;
  },
  userEntries: async (email) => {
    const user = await User.findOne({
      where: {
        email
      }
    });
    if(!user) {
      throw new Error("user not found");
    }

    const userEntries = await UserEntry.findAll({
      where: {
        userId: user.id
      }
    });

    const entryIds = userEntries.map(entry => entry.entryId);

    const entries = await Entry.findAll({
      where: {
        id: entryIds
      }
    });

    const result = await Promise.all(
      entries.map(async (entry) => {
        const tournament = await Tournament.findByPk(entry.tournamentId);

        return {
          ...entry.toJSON(),
          tournament
        }
      })
    )

    return result;
  },
  // Links an existing user (by email) to an entry they don't already own,
  // via the UserEntry join table. Once linked, that user's own
  // `userEntries(email)` lookup (used on Home/League/Portfolio) will
  // include this entry, and entry actions that check UserEntry membership
  // (e.g. ipoPurchase) will work for them - no other changes needed.
  addEntryOwner: async (entryId, email) => {
    const entry = await Entry.findByPk(entryId);
    if(!entry) {
      throw new Error("Entry not found");
    }

    const user = await User.findOne({
      where: {
        email
      }
    });
    if(!user) {
      throw new Error(`No account found for ${email} - they need to sign up first, then can be added as an owner.`);
    }

    const existingUserEntry = await UserEntry.findOne({
      where: {
        entryId,
        userId: user.id
      }
    });
    if(existingUserEntry) {
      throw new Error(`${email} is already an owner of this entry`);
    }

    await UserEntry.create({
      entryId,
      userId: user.id
    });

    return entry;
  },
  // Unlinks a user from an entry. Refuses to remove the last remaining
  // owner so an entry can never end up with zero owners - add a
  // replacement owner first, or delete the entry instead.
  removeEntryOwner: async (entryId, userId) => {
    const entry = await Entry.findByPk(entryId);
    if(!entry) {
      throw new Error("Entry not found");
    }

    const ownerCount = await UserEntry.count({
      where: {
        entryId
      }
    });
    if(ownerCount <= 1) {
      throw new Error("Can't remove the last owner of an entry - add another owner first, or delete the entry instead.");
    }

    const userEntry = await UserEntry.findOne({
      where: {
        entryId,
        userId
      }
    });
    if(!userEntry) {
      throw new Error("That user is not an owner of this entry");
    }

    await userEntry.destroy();

    return entry;
  },
  updateEntryCash: async (entryId, ipoCashSpent, secondaryMarketCashSpent, secondaryMarketCashIncome) => {
    const result = await instance.transaction(async (t) => {
      const entry = await Entry.findByPk(entryId, {transaction: t});

      await entry.update({
        ipoCashSpent,
        secondaryMarketCashSpent,
        secondaryMarketCashIncome
      }, {transaction: t});

      return entry;
    });

    return result;
  },
  portfolioSummaries: async (tournamentId, entryId) => {
    const t0 = Date.now();

    // --- DB queries: raw + minimal attributes to cut RDS→Lambda transfer ---
    const entries = await Entry.findAll({
      where: entryId ? { id: entryId } : { tournamentId },
      attributes: ['id', 'name', 'ipoCashSpent', 'secondaryMarketCashSpent', 'secondaryMarketCashIncome'],
      raw: true
    });
    if (!entries.length) return [];
    const entryIds = entries.map(e => e.id);

    const [userEntries, tournamentTeams, stocks] = await Promise.all([
      UserEntry.findAll({ where: { entryId: entryIds }, attributes: ['userId', 'entryId'], raw: true }),
      TournamentTeam.findAll({ where: { tournamentId }, attributes: ['id', 'isEliminated', 'price', 'milestoneData'], raw: true }),
      Stock.findAll({
        where: { tournamentTeamId: (await TournamentTeam.findAll({ where: { tournamentId }, attributes: ['id'], raw: true })).map(t => t.id) },
        attributes: ['id', 'tournamentTeamId', 'originalIpoEntryId'],
        raw: true
      })
    ]);

    const userIds = [...new Set(userEntries.map(ue => ue.userId))];
    const [users, stockEntries] = await Promise.all([
      User.findAll({ where: { id: userIds }, attributes: ['id', 'firstname', 'lastname'], raw: true }),
      StockEntry.findAll({ where: { entryId: entryIds }, attributes: ['entryId', 'stockId'], raw: true })
    ]);

    // --- Pre-build lookup Maps for O(1) access in the hot loop ---
    const stocksById = new Map(stocks.map(s => [s.id, s]));
    const usersById = new Map(users.map(u => [u.id, u]));

    // milestoneData may arrive as a JSON string with raw:true
    for (const team of tournamentTeams) {
      if (typeof team.milestoneData === 'string') {
        try { team.milestoneData = JSON.parse(team.milestoneData); } catch { team.milestoneData = []; }
      }
    }
    const teamsById = new Map(tournamentTeams.map(t => [t.id, t]));
    const notEliminatedSet = new Set(tournamentTeams.filter(t => !t.isEliminated).map(t => t.id));

    // Group stockEntries by entryId
    const stockEntriesByEntryId = new Map();
    for (const se of stockEntries) {
      if (!stockEntriesByEntryId.has(se.entryId)) stockEntriesByEntryId.set(se.entryId, []);
      stockEntriesByEntryId.get(se.entryId).push(se);
    }

    // teamStockCount: total stocks ever issued per team — must use all tournament stocks,
    // not stockEntries (which is scoped to the requested entry/entries and would give a
    // wrong divisor when called with a single entryId)
    const teamStockCount = {};
    for (const stock of stocks) {
      teamStockCount[stock.tournamentTeamId] = (teamStockCount[stock.tournamentTeamId] || 0) + 1;
    }

    const ipoCountByEntryId = new Map();
    for (const stock of stocks) {
      if (stock.originalIpoEntryId) {
        ipoCountByEntryId.set(stock.originalIpoEntryId, (ipoCountByEntryId.get(stock.originalIpoEntryId) || 0) + 1);
      }
    }

    // Group user names by entryId
    const namesByEntryId = new Map();
    for (const ue of userEntries) {
      const user = usersById.get(ue.userId);
      if (!user) continue;
      if (!namesByEntryId.has(ue.entryId)) namesByEntryId.set(ue.entryId, []);
      namesByEntryId.get(ue.entryId).push(`${user.firstname} ${user.lastname}`);
    }

    // Pre-compute dividend earned per stock owned for each team (same for all entries)
    const dividendPerStock = new Map();
    for (const team of tournamentTeams) {
      const totalStocks = teamStockCount[team.id] || 1;
      const milestones = team.milestoneData || [];
      const earned = milestones.reduce((sum, m) => {
        return sum + (m.dividendPrice ? Math.floor((m.dividendPrice / totalStocks) * 100) / 100 : 0);
      }, 0);
      dividendPerStock.set(team.id, earned);
    }

    // --- Per-entry calculation (now all O(1) lookups) ---
    const portfolioSummaries = entries.map(entry => {
      const ipoCashSpent = entry.ipoCashSpent || 0;
      const secondaryMarketCashSpent = entry.secondaryMarketCashSpent || 0;
      const secondaryMarketCashIncome = entry.secondaryMarketCashIncome || 0;

      const ownerName = (namesByEntryId.get(entry.id) || []).join(' & ');
      const stockEntriesOwned = stockEntriesByEntryId.get(entry.id) || [];

      const teamsOwned = new Set();
      const teamsOwnedInTourn = new Set();
      let moneyWon = 0, stockEntriesRemaining = 0, stockEntriesRemainingMoney = 0;

      for (const se of stockEntriesOwned) {
        const stock = stocksById.get(se.stockId);
        if (!stock) continue;
        const teamId = stock.tournamentTeamId;
        const team = teamsById.get(teamId);
        if (!team) continue;

        teamsOwned.add(teamId);

        if (notEliminatedSet.has(teamId)) {
          teamsOwnedInTourn.add(teamId);
          stockEntriesRemaining++;
          stockEntriesRemainingMoney += team.price || 0;
        }

        moneyWon += dividendPerStock.get(teamId) || 0;
      }

      const percentStocksRemaining = stockEntriesOwned.length > 0
        ? Math.round(stockEntriesRemaining / stockEntriesOwned.length * 10000) / 100 : 0;
      const percentMoneyWonInvested = ipoCashSpent > 0 ? moneyWon * 100 / ipoCashSpent : 0;
      const profitLoss = Math.round((moneyWon + secondaryMarketCashIncome - ipoCashSpent - secondaryMarketCashSpent) * 100) / 100;
      const percentMoneyRemaining = ipoCashSpent > 0
        ? Math.round(stockEntriesRemainingMoney / ipoCashSpent * 10000) / 100 : 0;

      return {
        ownerName,
        entryName: entry.name,
        totalInitialInvestment: ipoCashSpent,
        totalInitialStocksOwned: ipoCountByEntryId.get(entry.id) || 0,
        totalCurrentStocksOwned: stockEntriesOwned.length,
        stocksRemaining: stockEntriesRemaining,
        percentStocksRemaining,
        totalCurrentTeamsOwned: teamsOwned.size,
        totalCurrentTeamsRemaining: teamsOwnedInTourn.size,
        moneyWonToDate: Math.floor(moneyWon * 100) / 100,
        percentMoneyWonInvested: Math.round(percentMoneyWonInvested * 100) / 100,
        originalMoneyRemaining: Math.round(stockEntriesRemainingMoney * 100) / 100,
        profitLoss,
        percentMoneyRemaining
      };
    });

    console.log(`portfolioSummaries(${tournamentId}): ${entries.length} entries, ${stockEntries.length} stockEntries — ${Date.now() - t0}ms`);
    return portfolioSummaries;
  },
  createTeamMapFile: async (tournamentId) => {
      console.log("starting teamMapFile at ", new Date())

      const entries = await Entry.findAll({
          where: {
              tournamentId: tournamentId
          }
      });
      if (!entries && entries.length < 1) {throw new Error('Entries not found')}
      const entryIds = entries.map(entry => entry.id);

      const userEntries = await UserEntry.findAll({
        where: {
            entryId: entryIds
        }
      })
      if (!userEntries && userEntries.length < 1) {throw new Error('userEntries not found')}

      const tournamentTeams = await TournamentTeam.findAll({
        where: {
            tournamentId: tournamentId
        }
      })
      if (!tournamentTeams && tournamentTeams.length < 1) {throw new Error('userEntries not found')}
      const tournamentTeamIds = tournamentTeams.map(tournamentTeam => tournamentTeam.id)

      const stocks = await Stock.findAll({
        where: {
          tournamentTeamId: tournamentTeamIds
        }
      });
      if (!stocks && stocks.length < 1) {throw new Error('userEntries not found')}

      const stockEntries = await StockEntry.findAll({
        where: {
            entryId: entryIds
        }
      })
      if (!stockEntries && stockEntries.length < 1) {throw new Error('userEntries not found')}

      console.log("Creating TeamMapFile for " + tournamentId)
      const teamMap = stockEntries.reduce((resultMap, stockEntry) => {
          stock = stocks.find(stock => stock.id == stockEntry.stockId)
          matchedTournTeam = tournamentTeams.find(team => team.id == stock.tournamentTeamId)
          if (resultMap[matchedTournTeam.id]) {
              resultMap[matchedTournTeam.id] = resultMap[matchedTournTeam.id] + 1
              return resultMap
          } else {
              resultMap[matchedTournTeam.id] = 1
              return resultMap
          }
      }, {})
      fs.writeFileSync(__dirname  +`/../tmp/teamMap${tournamentId}`, JSON.stringify(teamMap), function (err) {
          if (err) {console.log(err)}
          console.log("data created and written to file", teamMap)
      });

      console.log("finished create TeamMapFile at ", new Date())
      return "Success"
  },
  deleteEntry: async (id) => {
    await instance.transaction(async (t) => {
      await StockEntry.destroy({ where: { entryId: id }, transaction: t });
      await EntryBid.destroy({ where: { entryId: id }, transaction: t });
      await UserEntry.destroy({ where: { entryId: id }, transaction: t });
      await Transaction.destroy({ where: { entryId: id }, transaction: t });
      await Entry.destroy({ where: { id }, transaction: t });
    });
  }
};

module.exports = EntryService;
