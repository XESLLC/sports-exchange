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

const EntryService = {
  createEntry: async (name, userEmails, tournamentId) => {
    const users = await User.findAll({
      where: {
        email: userEmails
      }
    });
    if(!users || users.length < 1) {
      throw new ApolloError("users not found");
    }

    const entry = await Entry.create({
      tournamentId,
      name,
      cash: 1000 // where does this default value come from? seems like it should be set on league
    });

    for(let user of users) {
      await UserEntry.create({
        userId: user.id,
        entryId: entry.id
      });
    }

    return entry;
  },
  createEntryBid: async (entryId, tournamentTeamId, price, quantity) => {
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
        quantity
      }, {transaction: t});

      // check for and execute matched trades
      // search for stocks available that i do not own
      const matchedStocks = await Stock.findAll({
        where: {
          price: {
            [Op.lte]: price
          },
          tournamentTeamId
        }
      });
      const matchedStockIds = matchedStocks.map(stock => stock.id);

      const matchedStockEntries = await StockEntry.findAll({
        where: {
          stockId: matchedStockIds
        }
      });

      const availableStocks = matchedStockEntries.filter(stock => stock.entryId !== entryId);
      const iteratorVal = Math.min(availableStocks.length, quantity);
      let trades = [];

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

        entry.cash -= tradePrice;
        entry.save({transaction: t});
        sellerEntry.cash += tradePrice;
        sellerEntry.save({transaction: t});

        const sellerTransaction = await Transaction.create({
          entryId: sellerEntry.id,
          stockId: stockToTrade.id,
          quantity: 1,
          cost: (tradePrice * -1)
        }, {transaction: t});

        const buyerTransaction = await Transaction.create({
          entryId,
          stockId: stockToTrade.id,
          quantity: 1,
          cost: tradePrice
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
    const entryBids = await EntryBid.findAll({
      where: {
        entryId
      }
    });

    const result = await Promise.all(
      entryBids.map(async(entryBid) => {
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

    return result;
  },
  ipoPurchase: async (tournamentTeamId, quantity, userEmail, entryId) => {
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

    const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
    const ipoPrice = tournamentTeam.price
    const team = await Team.findByPk(tournamentTeam.teamId)
    const totalPrice = ipoPrice * quantity;

    if(entry.cash < totalPrice) {
      throw new Error("You do not have enough cash to make this purchase");
    }
    entry.cash -= totalPrice;
    await entry.save();

    for(let i = 0; i < quantity; i++) {
      const stock = await Stock.create({
        price: null,
        tournamentTeamId
      });
      await StockEntry.create({
        entryId: entry.id,
        stockId: stock.id
      });
    }

    const result = {
      ipoPrice,
      quantity,
      teamName: team.name
    };

    return result;
  },
  userEntries: async (email) => {
    const user = await User.findOne({
      where: {
        email
      }
    });
    if(!user) {
      throw new ApolloError("user not found");
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

    return entries;
  }
};

module.exports = EntryService;