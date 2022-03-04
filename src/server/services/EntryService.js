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
        }
      });
      if(!entry) {
        throw new Error("entry not found");
      }

      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId);
      if(!tournamentTeam) {
        throw new Error("tournament team not found");
      }

      const team = await Team.findByPk(tournamentTeam.teamId);
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
        }
      });
      // this is a hack because [Op.lte] is not working correctly
      const matchedStocks = tournamentTeamStocks.filter(stock => stock.price <= price && stock.price !== null);
      const matchedStockIds = matchedStocks.map(stock => stock.id);

      const matchedStockEntries = await StockEntry.findAll({
        where: {
          stockId: matchedStockIds
        }
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
          }
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
          }
        });
        if(!sellerEntry) {
          throw new Error("Entry for seller not found");
        }
        stockEntryToTrade.entryId = entryId;
        await stockEntryToTrade.save({transaction: t});

        const stockToTrade = await Stock.findOne({
          where: {
            id: stockEntryToTrade.stockId
          }
        });
        if(!stockToTrade) {
          throw new Error("Stock to trade not found");
        }
        const tradePrice = stockToTrade.price;
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
      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId);
      if(!tournamentTeam) {
        throw new Error("Tournament team not found");
      }

      const tournament = await Tournament.findOne({
        where: {
          id: tournamentTeam.tournamentId
        }
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
        }
      });
      if(!entry) {
        throw new Error("Entry not found");
      }

      const user = await User.findOne({
        where: {
          email: userEmail
        }
      });
      if(!user) {
        throw new Error("User not found");
      }

      const userEntry = await UserEntry.findOne({
        where: {
          entryId: entry.id,
          userId: user.id
        }
      });
      if(!userEntry) {
        throw new Error("Not authorized for entry ipo purchase");
      }

      const ipoPrice = tournamentTeam.price
      const team = await Team.findByPk(tournamentTeam.teamId)
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
      const entry = await Entry.findByPk(entryId);

      await entry.update({
        ipoCashSpent,
        secondaryMarketCashSpent
      }, {transaction: t});

      return entry;
    });

    return result;
  }
};

module.exports = EntryService;