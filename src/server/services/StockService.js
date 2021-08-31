const TournamentTeam = require('../models/TournamentTeam');
const StockEntry = require('../models/StockEntry');
const Team = require('../models/Team');
const Stock = require('../models/Stock');
const User = require('../models/User');
const UserEntry = require('../models/UserEntry');
const Entry = require('../models/Entry');
const instance = require('../models/SequelizeInstance');
const Transaction = require('../models/Transaction');
const { Op } = require('sequelize');
const EntryBid = require('../models/EntryBid');
const { default: Tournament } = require('../models/Tournament');

const StockService = {
  getOfferedStocksForTournament: async (tournamentId, myEntryId) => {
    const entries = await Entry.findAll({
      where: {
        tournamentId
      }
    });
    if(!entries || entries.length < 1) {
      throw new Error(`entries for tournamentId: ${tournamentId} not found`);
    }
    const entryIds = entries.map(entry => entry.id);

    const stockEntries = await StockEntry.findAll({
      where: {
        entryId: entryIds
      }
    });

    const myStockEntries = stockEntries.filter(stockEntry => stockEntry.entryId === myEntryId);
    const leagueStockEntries = stockEntries.filter(stockEntry => stockEntry.entryId !== myEntryId);

    const myStockIds = myStockEntries.map(entry => entry.stockId);
    const leagueStockIds = leagueStockEntries.map(entry => entry.stockId);

    const myStocks = await Stock.findAll({
      where: {
        id: myStockIds
      }
    });
    const leagueStocks = await Stock.findAll({
      where: {
        id: leagueStockIds
      }
    });

    const myOfferedStocks = myStocks.filter(stock => stock.price !== null);
    const tournamentOfferedStocks = leagueStocks.filter(stock => stock.price !== null);

    const myStocksTournamentTeamFrequency = myOfferedStocks.reduce((_result, stock) => {
      const index = _result.findIndex(_stock => _stock.tournamentTeamId === stock.tournamentTeamId);
      if(!_result || index < 0) {
        _result.push({
          tournamentTeamId: stock.tournamentTeamId,
          numStocksForSale: 1,
          currentAskPrice: stock.price,
          offerExpiresAt: stock.offerExpiresAt
        });
      } else {
        _result[index].numStocksForSale += 1;
      }

      return _result;
    }, []);
    const leagueStocksTournamentTeamFrequency = tournamentOfferedStocks.reduce((_result, stock) => {
      const index = _result.findIndex(_stock => _stock.tournamentTeamId === stock.tournamentTeamId);
      if(!_result || index < 0) {
        _result.push({
          tournamentTeamId: stock.tournamentTeamId,
          numStocksForSale: 1,
          currentAskPrice: stock.price,
          offerExpiresAt: stock.offerExpiresAt
        });
      } else {
        _result[index].numStocksForSale += 1;
      }

      return _result;
    }, []);

    const myStockOffers = myStocksTournamentTeamFrequency.map(async (stock) => {
      const tournamentTeam = await TournamentTeam.findByPk(stock.tournamentTeamId);
      const team = await Team.findByPk(tournamentTeam.teamId);

      return {
        ...stock,
        teamName: team.name
      }
    });
    const leagueStockOffers = leagueStocksTournamentTeamFrequency.map(async (stock) => {
      const tournamentTeam = await TournamentTeam.findByPk(stock.tournamentTeamId);
      const team = await Team.findByPk(tournamentTeam.teamId);

      return {
        ...stock,
        teamName: team.name
      }
    });

    return {
      myStockOffers,
      leagueStockOffers
    };
  },
  stocksByEntryId: async (entryId) => {
    const stockEntries = await StockEntry.findAll({
      where: {
        entryId
      }
    });

    const stockIds = stockEntries.map(entry => entry.stockId);
    const stocks = await Stock.findAll({
      where: {
        id: stockIds
      }
    });

    const stocksTournamentTeamFrequencyObj = stocks.reduce((result, stock) => {
      if(result && result[stock.tournamentTeamId]) {
        result[stock.tournamentTeamId] += 1;
      } else {
        result[stock.tournamentTeamId] = 1;
      }

      return result;
    }, {});

    const result = Object.keys(stocksTournamentTeamFrequencyObj).map(async (tournamentTeamId) => {
      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
      const ipoPrice = tournamentTeam.price
      const team = await Team.findByPk(tournamentTeam.teamId)
      const quantity = stocksTournamentTeamFrequencyObj[tournamentTeamId];

      return {
        teamName: team.name,
        teamId: team.id,
        tournamentTeamId,
        ipoPrice,
        quantity
      }
    });
    
    return result;
  },
  getOriginallyPurchasedStocks: async (entryId) => {
    const stockEntries = await StockEntry.findAll({
      where: {
        entryId
      }
    });

    const stockIds = stockEntries.map(entry => entry.stockId);
    const stocks = await Stock.findAll({
      where: {
        id: stockIds,
        originalIpoEntryId: entryId
      }
    });

    return stocks;
  },
  sellEntryStocks: async (email, entryId, tournamentTeamId, quantity) => {
    const user = await User.findOne({
      where: {
        email
      }
    });
    if(!user) {
      throw new Error("User not found");
    }

    const entry = await Entry.findOne({
      where: {
        id: entryId
      }
    });
    if(!entry) {
      throw new Error("Entry not found");
    }

    const userEntry = await UserEntry.findOne({
      where: {
        entryId: entry.id,
        userId: user.id
      }
    });
    if(!userEntry) {
      throw new Error("User for entry not found");
    }

    const stockEntries = await StockEntry.findAll({
      where: {
        entryId
      }
    });
    const stockIds = stockEntries.map(entry => entry.stockId);

    const stocks = await Promise.all(
      stockIds.map(async (id) => {
        return await Stock.findOne({
          where: {
            id
          }
        });
      })
    );
    const stocksAvailableForDeletion = stocks.filter(stock => stock.tournamentTeamId === tournamentTeamId);

    if(stocksAvailableForDeletion.length < quantity) {
      throw new Error("Attempting to sell more stocks than owned");
    }

    let stockIdsForDeletion = [];
    for(let i = 0; i < quantity; i++) {
      stockIdsForDeletion.push(stocksAvailableForDeletion[i].id);
    }
    if(stockIdsForDeletion.length < 1) {
      throw new Error("Something went wrong getting stock ids to delete");
    }

    await Promise.all(
      stockIdsForDeletion.map(async (id) => {
        try {
          await StockEntry.destroy({
            where: {
              stockId: id
            }
          });
          await Stock.destroy({
            where: {
              id
            }
          });
        } catch {
          throw new Error("Could not sell stocks");
        }
      })
    );

    const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
    const ipoPrice = tournamentTeam.price
    const amountToCredit = ipoPrice * quantity;
    entry.ipoCashSpent -= amountToCredit;
    await entry.save();

    const updatedStocks = await Stock.findAll({
      where: {
        id: stockIds,
        tournamentTeamId
      }
    });

    const stocksTournamentTeamFrequencyObj = updatedStocks.reduce((result, stock) => {
      if(result && result[stock.tournamentTeamId]) {
        result[stock.tournamentTeamId] += 1;
      } else {
        result[stock.tournamentTeamId] = 1;
      }

      return result;
    }, {});

    const result = Object.keys(stocksTournamentTeamFrequencyObj).map(async (tournamentTeamId) => {
      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
      const ipoPrice = tournamentTeam.price
      const team = await Team.findByPk(tournamentTeam.teamId)
      const quantity = stocksTournamentTeamFrequencyObj[tournamentTeamId];

      return {
        teamName: team.name,
        teamId: team.id,
        ipoPrice,
        quantity
      }
    });
    
    return result;
  },
  setStockAskPrice: async (email, entryId, tournamentTeamId, quantity, newPrice, offerExpiresAt) => {
    const result = await instance.transaction(async (t) => {
      const user = await User.findOne({
        where: {
          email
        }
      });
      if(!user) {
        throw new Error("User not found");
      }

      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId);
      if(!tournamentTeam) {
        throw new Error("tournament team not found");
      }

      const team = await Team.findByPk(tournamentTeam.teamId);
      if(!team) {
        throw new Error("team not found");
      }

      const entry = await Entry.findOne({
        where: {
          id: entryId
        }
      });
      if(!entry) {
        throw new Error("Entry not found");
      }

      const userEntry = await UserEntry.findOne({
        where: {
          entryId: entry.id,
          userId: user.id
        }
      });
      if(!userEntry) {
        throw new Error("User for entry not found");
      }

      const stockEntries = await StockEntry.findAll({
        where: {
          entryId
        }
      });
      const stockIds = stockEntries.map(entry => entry.stockId);

      const stocks = await Promise.all(
        stockIds.map(async (id) => {
          return await Stock.findOne({
            where: {
              id
            }
          });
        })
      );
      const stocksAvailableToUpdate = stocks.filter(stock => stock.tournamentTeamId === tournamentTeamId);

      if(stocksAvailableToUpdate.length < quantity) {
        throw new Error("Attempting to set stock price on more stocks than owned");
      }

      // set all the current stock prices to null before updating with new stock price
      await Promise.all(
        stocksAvailableToUpdate.map(async (stock) => {
          try {
            stock.price = null;
            stock.offerExpiresAt = null;
            await stock.save({transaction: t});
          } catch {
            throw new Error("Error updating stock prices");
          }
        })
      );

      let stockToUpdate = [];
      for(let i = 0; i < quantity; i++) {
        stockToUpdate.push(stocksAvailableToUpdate[i]);
      }
      if(stockToUpdate.length < 1) {
        throw new Error("Something went wrong getting stock ids to delete");
      }

      await Promise.all(
        stockToUpdate.map(async (stock) => {
          try {
            stock.price = newPrice;
            stock.offerExpiresAt = offerExpiresAt;
            await stock.save({transaction: t});
          } catch {
            throw new Error("Could not set new stock price");
          }
        })
      );

      const updatedStocks = await Stock.findAll({
        where: {
          id: stockIds,
          tournamentTeamId
        }
      });

      const stocksTournamentTeamFrequencyObj = updatedStocks.reduce((result, stock) => {
        if(result && result[stock.tournamentTeamId]) {
          result[stock.tournamentTeamId] += 1;
        } else {
          result[stock.tournamentTeamId] = 1;
        }

        return result;
      }, {});

      // check for and execute matched trades
      // search for stocks available that i do not own
      let matchedBids = await EntryBid.findAll({
        where: {
          entryId: {
            [Op.not]: entryId
          },
          tournamentTeamId
        }
      });
      // this is a hack because [Op.gte] is not working correctly
      matchedBids = matchedBids.filter(bid => bid.price >= newPrice)
      const totalQuantityOfMatchedBids = matchedBids.reduce((result, bid) => {
        return result += bid.quantity
      }, 0);

      const iteratorVal = Math.min(totalQuantityOfMatchedBids, quantity);
      let trades = [];

      for(let i = 0; i < iteratorVal; i++) {
        const stockToTrade = stockToUpdate[i];
        const buyerEntry = await Entry.findOne({
          where: {
            id: matchedBids[0].entryId
          }
        });
        if(!buyerEntry) {
          throw new Error("Entry for buyer not found");
        }

        const stockEntryToTrade = await StockEntry.findOne({
          where: {
            stockId: stockToTrade.id
          }
        });
        if(!stockEntryToTrade) {
          throw new Error("Stock entry to trade not found");
        }

        stockEntryToTrade.entryId = buyerEntry.id;
        await stockEntryToTrade.save({transaction: t});

        const tradePrice = stockToTrade.price;
        stockToTrade.price = null;
        await stockToTrade.save({transaction: t});

        buyerEntry.secondaryMarketCashSpent += tradePrice;
        buyerEntry.save({transaction: t});
        entry.secondaryMarketCashSpent -= tradePrice;
        entry.save({transaction: t});

        const sellerTransaction = await Transaction.create({
          entryId,
          stockId: stockToTrade.id,
          quantity: 1,
          cost: (tradePrice * -1)
        }, {transaction: t});

        const buyerTransaction = await Transaction.create({
          entryId: buyerEntry.id,
          stockId: stockToTrade.id,
          quantity: 1,
          cost: tradePrice
        }, {transaction: t});

        trades.push({
          ...sellerTransaction.toJSON(),
          teamName: team.name,
          tournamentTeamId
        });

        trades.push({
          ...buyerTransaction.toJSON(),
          teamName: team.name,
          tournamentTeamId
        });

        matchedBids[0].quantity -= 1;
        await matchedBids[0].save({transaction: t});
        if(matchedBids[0].quantity === 0) {
          matchedBids.shift();
        }
      }

      const bidsToDelete = await EntryBid.findAll({
        where: {
          quantity: 0
        }
      });

      for(let bid of bidsToDelete) {
        await bid.destroy({transaction: t});
      }

      return Object.keys(stocksTournamentTeamFrequencyObj).map(async (tournamentTeamId) => {
        const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
        const ipoPrice = tournamentTeam.price
        const team = await Team.findByPk(tournamentTeam.teamId)
        const quantity = stocksTournamentTeamFrequencyObj[tournamentTeamId];

        return {
          teamName: team.name,
          teamId: team.id,
          ipoPrice,
          quantity,
          trades
        }
      });
    });

    return result;
  },
  setTournamentTeamStockPriceToNull: async (tournamentTeamId, entryId) => {
    const entry = await Entry.findByPk(entryId);

    const stockEntries = await StockEntry.findAll({
      where: {
        entryId
      }
    });
    const stockIds = stockEntries.map(stockEntry => stockEntry.stockId);

    const stocks = await Stock.findAll({
      where: {
        id: stockIds,
        price: {
          [Op.not]: null
        },
        tournamentTeamId
      }
    });

    for(let i = 0; i < stocks.length; i++) {
      stocks[i].price = null;
      await stocks[i].save();
    }

    return entry;
  }
};

module.exports = StockService;