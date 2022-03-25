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

const EntryService = {
  createEntry: async (name, userEmails, tournamentId) => {
    const users = await User.findAll({
      where: {
        email: userEmails
      }
    });
    if(!users || users.length < 1) {
      throw new Error("users not found");
    }

    const entry = await Entry.create({
      tournamentId,
      name,
      ipoCashSpent: 0,
      secondaryMarketCashSpent: 0
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

        sellerEntry.secondaryMarketCashSpent -= (price * entryStockQuantityObj[sellerEntryId]);
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
  updateEntryCashSpent: async (entryId, ipoCashSpent, secondaryMarketCashSpent) => {
    const result = await instance.transaction(async (t) => {
      const entry = await Entry.findByPk(entryId, {transaction: t});

      await entry.update({
        ipoCashSpent,
        secondaryMarketCashSpent
      }, {transaction: t});

      return entry;
    });

    return result;
  },
  portfolioSummaries: async (tournamentId, entryId) => {
    console.log("starting portfolioSummaries")
    let entries;
    if (!entryId) {
      entries = await Entry.findAll({
          where: {
              tournamentId: tournamentId
          }
      });
    } else {
      entries = await Entry.findAll({
          where: {
              id: entryId
          }
      });
    }

    const entryIds = entries.map(entry => entry.id);

    const userEntries = await UserEntry.findAll({
      where: {
          entryId: entryIds
      }
    })

    const userIds = userEntries.map(userEntry => userEntry.userId);

    const users = await User.findAll({
      where: {
        id: userIds
      }
    })

    const tournamentTeams = await TournamentTeam.findAll({
      where: {
          tournamentId: tournamentId
      }
    })

    const tournamentTeamIds = tournamentTeams.map(tournamentTeam => tournamentTeam.id);

    const stocks = await Stock.findAll({
      where: {
        tournamentTeamId: tournamentTeamIds
      }
    });

    console.log("before entries map")
    const portfolioSummaries = await Promise.all(
        entries.map(async(entry) => {
          let names = []
          for(let userEntry of userEntries) {
              const user = users.find(_user => _user.id = userEntry.userId)
              names.push (user.firstName + " " + user.lastName)
          }
          const combinedNames = names.reduce((result, userName) => {
              if (result.length > 0) {
                  return result + " & " + userName
              }
              return userName
          }, "")

          const initialIpoStocks = stocks.filter(stock => stock.originalIpoEntryId === entry.id)

          const initialIpoStockInvestment = initialIpoStocks.reduce((cost, stock) => {
              const teams = tournamentTeams.filter((tournamentTeam) => {
                  return tournamentTeam.id == stock.tournamentTeamId
              }) // result should always be one team
              return cost += teams[0].price
          }, 0)

          const currentStocksOwned = await StockEntry.findAll({
              where: {
                  entryId: entry.id
              }
          })

          const stocksRemaining = currentStocksOwned.filter((stockOwned) => {
              const teams = tournamentTeams.filter(team => {
                  const stockMatch = stocks.find(stock => stock.id === stockOwned.stockId)
                  return team.id === stockMatch.tournamentTeamId
              }) // result should always be one team
              return teams[0].isEliminated? false : true
          })

          const teamsOwnedMayBeEliminated = tournamentTeams.filter((tournamentTeam) => {
                return currentStocksOwned.reduce((hasTeam, stock) => {
                  if (!hasTeam) {
                      return stock.tournamentTeamId == tournamentTeam.id
                  }
              }, false)
          })

          const teamsOwnedNotEliminated = tournamentTeams.filter((tournamentTeam) => {
                return currentStocksOwned.reduce((hasTeam, stock) => {
                  if (!hasTeam) {
                      return stock.tournamentTeamId == tournamentTeam.id && !tournamentTeam.isEliminated
                  }
              }, false)
          })

          const percentStocksRemaining = Math.round(initialIpoStocks.length/stocksRemaining.length * 10)/10

          const moneyWonToDateAndRemainIpoValue = stocksRemaining.reduce((result, stock) => {
              const matchedTournTeam = tournamentTeams.reduce((matchedTeam, tournamentTeam) => {
                  if (!matchedTeam.team && tournamentTeam.id == stock.tournamentTeamId) {
                      return tournamentTeam
                  }
              }, {})
              result.moneyWon += matchedTournTeam.milestoneData.dividendPrice
              result.remIpoVal += matchedTournTeam.price
              return result
          }, {moneyWon: 0, remIpoVal: 0})

          const percentMoneyWonInvested = moneyWonToDateAndRemainIpoValue.moneyWon/ipoCashSpent

          return  {
            ownerName: combinedNames,
            entryName: entry.name,
            totalInitalInvestment: initialIpoStockInvestment, // initial ipo investment
            totalInitialStocksOwned: initialIpoStocks.length, //
            totalCurrentStocksOwned: currentStocksOwned.length, //total owned and eliminated
            stocksRemaining: stocksRemaining.length, //total of whats not eliminated
            percentStocksRemaining: percentStocksRemaining,
            totalCurrentTeamsOwned: teamsOwnedMayBeEliminated.length, //number teams owned & may have been eliminated
            totalCurrentTeamsRemaining: teamsOwnedNotEliminated.length, // number of teams that are left in tourn
            moneyWonToDate: moneyWonToDateAndRemainIpoValue.moneyWon,
            percentMoneyWonInvested: percentMoneyWonInvested,
            originalMoneyRemaining: moneyWonToDateAndRemainIpoValue.remIpoVal, //money left from ipo
            profitLoss: moneyWonToDateAndRemainIpoValue.moneyWon + moneyWonToDateAndRemainIpoValue.remIpoVal - entry.ipoCashSpent - entry.secondaryMarketCashSpent, //money won - ipo - secondary market cash
            percentMoneyRemaining: (moneyWonToDateAndRemainIpoValue.remIpoVal + moneyWonToDateAndRemainIpoValue.remIpoVal)/(entry.ipoCashSpent + entry.secondaryMarketCashSpent) // allMoney/totalInvestment
          }
      })
    )
    console.log("portfolio summaries return: " + JSON.stringify(portfolioSummaries))
    return portfolioSummaries
  }
};

module.exports = EntryService;
