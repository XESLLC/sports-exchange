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
const { v4: uuidv4 } = require('uuid');
const {sendEmail} = require ('../util/sendEmail');

const StockService = {
  removeExpiredBidsAndAsks:async (tournamentId) => {
      const tournamentTeams = await TournamentTeam.findAll({
        where: {tournamentId: tournamentId}
      })
      const tournamentTeamIds = tournamentTeams.map((tournamentTeam) => {
        return tournamentTeam.id
      })
      // remove ask
      await Stock.update({ offerExpiresAt: null, price: null, tradableTeams: null}, {
          where: {
              tournamentTeamId: tournamentTeamIds,
              offerExpiresAt: {[Op.lt]: new Date()}
          }
      });
      // remove bid
      await EntryBid.destroy({
          where: {
              tournamentTeamId: tournamentTeamIds,
              expiresAt: {[Op.lt]: new Date()}
          }
      })

      return 'sucess';
  },

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

    const myOfferedStocks = myStocks.filter((stock) => stock.price !== null || stock.tradableTeams !== null);
    const tournamentOfferedStocks = leagueStocks.filter(stock => stock.price !== null || stock.tradableTeams !== null);

    const myStocksTournamentTeamFrequency = myOfferedStocks.reduce((_result, stock) => {
      const index = _result.findIndex(_stock => _stock.tournamentTeamId === stock.tournamentTeamId);
      if(!_result || index < 0) {
        _result.push({
          stockId: stock.id,
          tournamentTeamId: stock.tournamentTeamId,
          numStocksForSale: 1,
          currentAskPrice: stock.price,
          offerExpiresAt: stock.offerExpiresAt,
          tradableTeams: stock.tradableTeams
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
          stockId: stock.id,
          tournamentTeamId: stock.tournamentTeamId,
          numStocksForSale: 1,
          currentAskPrice: stock.price,
          offerExpiresAt: stock.offerExpiresAt,
          tradableTeams: stock.tradableTeams
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
        result[stock.tournamentTeamId]["quantity"] += 1;
        result[stock.tournamentTeamId]["stockIds"].push(stock.id);
      } else {
        result[stock.tournamentTeamId] = {
          quantity: 1,
          stockIds: [stock.id]
        }
      }

      return result;
    }, {});

    const result = Object.keys(stocksTournamentTeamFrequencyObj).map(async (tournamentTeamId) => {
      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
      const ipoPrice = tournamentTeam.price
      const team = await Team.findByPk(tournamentTeam.teamId)
      const quantity = stocksTournamentTeamFrequencyObj[tournamentTeamId].quantity;
      const seed = tournamentTeam.seed;
      const region = tournamentTeam.region;
      const stockIds = stocksTournamentTeamFrequencyObj[tournamentTeamId].stockIds;

      return {
        teamName: team.name,
        teamId: team.id,
        tournamentTeamId,
        ipoPrice,
        quantity,
        seed,
        region,
        stockIds
      }
    });

    return result;
  },
  getOriginallyPurchasedStocks: async (entryId) => {
    const stocks = await Stock.findAll({
      where: {
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
  setStockAskPrice: async (email, entryId, tournamentTeamId, quantity, newPrice, offerExpiresAt, tradableTeams) => {
    // TODO wrapping in transaction calls commit and fails around line 456, cant seem to loop matchedBids
    // const result = await instance.transaction(async (t) => {
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
            await stock.update({
              price: null,
              offerExpiresAt: null,
              tradableTeams: null
            });
          } catch {
            throw new Error("Error updating stock prices");
          }
        })
      );

      let stocksToUpdate = [];
      for(let i = 0; i < quantity; i++) {
        stocksToUpdate.push(stocksAvailableToUpdate[i]);
      }
      if(stocksToUpdate.length < 1) {
        throw new Error("Something went wrong getting stock ids to delete");
      }

      if(!newPrice && !tradableTeams) {
        throw new Error("Stock price or tradable teams must be provided");
      }

      // set either the new stock ask price or tradableTeams
      await Promise.all(
        stocksToUpdate.map(async (stock) => {
          try {
            await stock.update({
              price: newPrice,
              offerExpiresAt,
              tradableTeams: tradableTeams ? JSON.parse(JSON.stringify(tradableTeams)) : null
            });
          } catch {
            throw new Error("Could not set new stock price");
          }
        })
      );

      let updatedStocks = await Stock.findAll({
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
      matchedBids = matchedBids.filter(bid => bid.price >= newPrice);
      const totalQuantityOfMatchedBids = matchedBids.reduce((result, bid) => {
        return result += bid.quantity
      }, 0);

      const iteratorVal = Math.min(totalQuantityOfMatchedBids, quantity);
      let trades = [];
      let transactionCounter = 0;
      let entryBidQuantityObj = {};
      for(let bid of matchedBids) {
        const currentQuantityOfBids = Object.keys(entryBidQuantityObj).reduce((result, entryId) => {
          return result += entryBidQuantityObj[entryId].quantity;
        }, 0);

        if(currentQuantityOfBids < iteratorVal) {
          if(!entryBidQuantityObj[bid.entryId]) {
            const quantityToAdd = Math.min(bid.quantity, iteratorVal);
            entryBidQuantityObj[bid.entryId] = quantityToAdd;
          }
        }
      }

      await Promise.all(
        Object.keys(entryBidQuantityObj).map(async (buyerEntryId) => {
          const buyerEntry = await Entry.findOne({
            where: {
              id: buyerEntryId
            }
          });

          buyerEntry.secondaryMarketCashSpent += (newPrice * entryBidQuantityObj[buyerEntryId]);
          await buyerEntry.save();
          entry.secondaryMarketCashSpent -= (newPrice * entryBidQuantityObj[buyerEntryId]);
          await entry.save();
        })
      );

      let buyerEntryForEmail;
      let amountPerShare;
      if(transactionCounter < iteratorVal) {
        const transactionGroupId = uuidv4();
        for(let i = 0; i < matchedBids.length; i++) {
          let stockToUpdate;
          if(i === 0) {
            stockToUpdate = stocksToUpdate.splice(0, matchedBids[i].quantity);
          } else {
            const alreadyUpdatedIndex = matchedBids.reduce((result, bid, _index) => {
              if(_index < i) {
                result += bid.quantity;
              }
            }, 1);
            stockToUpdate = stocksToUpdate.splice(alreadyUpdatedIndex, matchedBids[i].quantity);
          }

          const buyerEntry = await Entry.findOne({
            where: {
              id: matchedBids[i].entryId
            }
          });
          if(!buyerEntry) {
            throw new Error("Entry for buyer not found");
          }
          buyerEntryForEmail = JSON.parse(JSON.stringify(buyerEntry));

          await Promise.all(
            stockToUpdate.map(async (stock) => {
              const stockEntryToTrade = await StockEntry.findOne({
                where: {
                  stockId: stock.id
                }
              });
              if(!stockEntryToTrade) {
                throw new Error("Stock entry to trade not found");
              }
    
              stockEntryToTrade.entryId = buyerEntry.id;
              await stockEntryToTrade.save();
    
              const tradePrice = stock.price;
              amountPerShare = stock.price;
              stock.price = null;
              await stock.save();
    
              const sellerTransaction = await Transaction.create({
                entryId,
                stockId: stock.id,
                quantity: 1,
                cost: (tradePrice * -1),
                groupId: transactionGroupId
              });
    
              const buyerTransaction = await Transaction.create({
                entryId: buyerEntry.id,
                stockId: stock.id,
                quantity: 1,
                cost: tradePrice,
                groupId: transactionGroupId
              });
    
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
            })
          );

          matchedBids[i].quantity -= stockToUpdate.length;
          await matchedBids[i].save();
          transactionCounter += stockToUpdate.length;
        }
      }

      for(let bid of matchedBids) {
        if(bid.quantity === 0) {
          await bid.destroy();
        }
      }

      if(transactionCounter > 0) {
        const plural = transactionCounter > 1 ? 's' : '';
        const message = `You sold ${transactionCounter} share${plural} of ${team.name} to ${buyerEntryForEmail.name} for $${amountPerShare} per share`;
        const buyerMessage = `You bought ${transactionCounter} share${plural} of ${team.name} from ${entry.name} for $${amountPerShare} per share`;
    
        const userEntries = await UserEntry.findAll({
          where: {
            entryId
          }
        });
    
        const userIds = userEntries.map(userEntry => userEntry.userId);
    
        const users = await User.findAll({
          where: {
            id: userIds
          }
        });
    
        const emailAddressToSendTradeNotification = users.map(user => user.email);
    
        for(let email of emailAddressToSendTradeNotification) {
          await sendEmail(email, 'Trade Notification', message);
        }

        const buyerEntries = await UserEntry.findAll({
          where: {
            entryId: buyerEntryForEmail.id
          }
        });

        const buyerUserIds = buyerEntries.map(userEntry => userEntry.userId);
    
        const buyerUsers = await User.findAll({
          where: {
            id: buyerUserIds
          }
        });
    
        const buyerEmailAddressToSendTradeNotification = buyerUsers.map(user => user.email);
    
        for(let email of buyerEmailAddressToSendTradeNotification) {
          await sendEmail(email, 'Trade Notification', buyerMessage)
        }
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
    // });

    // return result;
  },
  tradeStocks: async (email, entryId, stockIdToTradeFor, quantity, tradableTeams, teamName) => {
    const result = await instance.transaction(async (t) => {
      const user = await User.findOne({
        where: {
          email
        },
        transaction: t
      });
      if(!user) {
        throw new Error("User not found");
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

      const userEntry = await UserEntry.findOne({
        where: {
          entryId: entry.id,
          userId: user.id
        },
        transaction: t
      });
      if(!userEntry) {
        throw new Error("User for entry not found");
      }

      let stockIdsToTradeFor = [stockIdToTradeFor];
      const transactionGroupId = uuidv4();

      if(quantity > 1) {
        const instanceOfStockToTradeFor = await Stock.findByPk(stockIdToTradeFor, {transaction: t});

        const instanceOfStockEntry = await StockEntry.findOne({
          where: {
            stockId: instanceOfStockToTradeFor.id
          },
          transaction: t
        });
        const stocksByTournamentTeamId = await Stock.findAll({
          where: {
            tournamentTeamId: instanceOfStockToTradeFor.tournamentTeamId,
            tradableTeams: {
              [Op.not]: null
            }
          },
          transaction: t
        });
        const tradableStockIds = stocksByTournamentTeamId.map(stock => stock.id);

        const tradableStockEntries = await StockEntry.findAll({
          where: {
            stockId: tradableStockIds,
            entryId: instanceOfStockEntry.entryId
          },
          limit: quantity,
          transaction: t
        });

        stockIdsToTradeFor = tradableStockEntries.map(stockEntry => stockEntry.stockId);
      }

      // find all stocks by stockIdsToTradeFor
      // set stock.tradableTeams = null
      // set stock.offerExpiresAt = null
      const stocksToTradeFor = await Stock.findAll({
        where: {
          id: stockIdsToTradeFor
        },
        transaction: t
      });

      for(const stock of stocksToTradeFor) {
        await stock.update({
          offerExpiresAt: null,
          price: null,
          tradableTeams: null
        }, {transaction: t});
      }

      // find stock entries by stockId = stock.id
      // update all stockEntries.entryId = entry.id
      const stockEntriesToTradeFor = await StockEntry.findAll({
        where: {
          stockId: stockIdsToTradeFor
        },
        transaction: t
      });

      const otherUserEntryId = JSON.parse(JSON.stringify(stockEntriesToTradeFor))[0].entryId;
      const otherUserEntry = await Entry.findByPk(otherUserEntryId, {transaction: t});

      for(const stockEntry of stockEntriesToTradeFor) {
        await stockEntry.update({
          entryId: entry.id
        }, {transaction: t});

        // the way we will track stock for stock transactions is to create one transaction for the entry that is gaining stock
        await Transaction.create({
          quantity: 1,
          cost: 0,
          stockId: stockEntry.stockId,
          entryId: entryId,
          groupId: transactionGroupId
        }, {transaction: t});
      }

      // loop each tradableTeam
      // find the userStockEntries and build a list of their stockIds
      // find all stocks in that stockIds list
      // from that stock list, grab the amount of stocks === the instance of tradableTeam.quantity && tradableTeam.tournamentTeamId === found stock.tournamentTeamId
      // update their entryId to be the other user's entryId
      const userStockEntries = await StockEntry.findAll({
        where: {
          entryId
        },
        transaction: t
      });
      const stockIds = userStockEntries.map(entry => entry.stockId);

      const userStocks = await Stock.findAll({
        where: {
          id: stockIds
        },
        transaction: t
      });

      let initiatorTradePackage = "";
      for(const team of tradableTeams) {
        const plural = team.quantity > 1 ? 's' : '';
        const comma = tradableTeams.length > 1 ? ', ' : '';
        initiatorTradePackage += `${team.quantity} share${plural} of ${team.teamName}${comma}`;
        const stocksAvailableToTrade = userStocks.filter(stock => stock.tournamentTeamId === team.tournamentTeamId);
        const numStocksAvailableToTrade = stocksAvailableToTrade.length;
        
        if(numStocksAvailableToTrade < team.quantity) {
          throw new Error(`You do not have enough stock of ${team.teamName} to process this trade`);
        }

        for(let i = 0; i < team.quantity; i++) {
          const tradableStock = stocksAvailableToTrade[i];

          const stockEntryToUpdate = await StockEntry.findOne({
            where: {
              stockId: tradableStock.id
            },
            transaction: t
          });

          await stockEntryToUpdate.update({
            entryId: otherUserEntryId
          }, {transaction: t});

          await Transaction.create({
            quantity: 1,
            cost: 0,
            stockId: tradableStock.id,
            entryId: otherUserEntryId,
            groupId: transactionGroupId
          }, {transaction: t});
        }
      }

      const plural = quantity > 1 ? 's' : '';
      const passiveTradePackage = `${quantity} share${plural} of ${teamName}`;
      const initiatorMessage = `You traded ${initiatorTradePackage} to ${otherUserEntry.name} for ${passiveTradePackage}`;
      const passiveMessage = `You traded ${passiveTradePackage} to ${entry.name} for ${initiatorTradePackage}`;
  
      const initiatorUserEntries = await UserEntry.findAll({
        where: {
          entryId
        },
        transaction: t
      });
  
      const userIds = initiatorUserEntries.map(userEntry => userEntry.userId);
  
      const users = await User.findAll({
        where: {
          id: userIds
        },
        transaction: t
      });
  
      const initiatorEmailAddressToSendTradeNotification = users.map(user => user.email);
  
      for(let email of initiatorEmailAddressToSendTradeNotification) {
        await sendEmail(email, 'Trade Notification', initiatorMessage);
      }

      const passiveUserEntries = await UserEntry.findAll({
        where: {
          entryId: otherUserEntryId
        },
        transaction: t
      });

      const passiveUserIds = passiveUserEntries.map(userEntry => userEntry.userId);
  
      const passiveUsers = await User.findAll({
        where: {
          id: passiveUserIds
        },
        transaction: t
      });
  
      const passiveEmailAddressToSendTradeNotification = passiveUsers.map(user => user.email);
  
      for(let email of passiveEmailAddressToSendTradeNotification) {
        await sendEmail(email, 'Trade Notification', passiveMessage);
      }

      const groupedTransactions = await Transaction.findAll({
        where: {
          groupId: transactionGroupId
        },
        transaction: t
      });

      return groupedTransactions;
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

    const pricedStocks = await Stock.findAll({
      where: {
        id: stockIds,
        price: {
          [Op.not]: null
        },
        tournamentTeamId
      }
    });

    for(let i = 0; i < pricedStocks.length; i++) {
      pricedStocks[i].price = null;
      await pricedStocks[i].save();
    }

    const tradableStocks = await Stock.findAll({
      where: {
        id: stockIds,
        tradableTeams: {
          [Op.not]: null
        },
        tournamentTeamId
      }
    });

    for(let i = 0; i < tradableStocks.length; i++) {
      tradableStocks[i].tradableTeams = null;
      await tradableStocks[i].save();
    }

    return entry;
  },
  deleteStocks: async (entryId, stockIds) => {
    // const result = await instance.transaction(async (t) => {
      const entry = await Entry.findByPk(entryId);

      // await StockEntry.destroy({
      //   where: {
      //     entryId,
      //     stockId: stockIds
      //   }
      // }, {transaction: t});
      await StockEntry.destroy({
        where: {
          entryId,
          stockId: stockIds
        }
      });

      const stocks = await Stock.findAll({
        where: {
          id: stockIds
        }
      });

      const tournamentTeam = await TournamentTeam.findByPk(stocks[0].tournamentTeamId);
      const cashAmountToRefund = stockIds.length * tournamentTeam.price;

      await Stock.findAll({
        where: {
          id: stockIds
        }
      });

      // await entry.update({
      //   ipoCashSpent: entry.ipoCashSpent - cashAmountToRefund
      // }, {transaction: t});
      await entry.update({
        ipoCashSpent: entry.ipoCashSpent - cashAmountToRefund
      });

      return entry;
    // });

    // return result;
  },
  manualTrade: async (entryId, stockIds, receivingEntryId, pricePerStock) => {
    const result = await instance.transaction(async (t) => {
      const entry = await Entry.findByPk(entryId, {transaction: t});
      const receivingEntry = await Entry.findByPk(receivingEntryId, {transaction: t});

      const stockEntries = await StockEntry.findAll({
        where: {
          stockId: stockIds,
          entryId
        },
        transaction: t
      });

      for(const stockEntry of stockEntries) {
        await stockEntry.update({
          entryId: receivingEntryId
        }, {transaction: t});
      }

      const stocks = await Stock.findAll({
        where: {
          id: stockIds
        },
        transaction: t
      });

      const tournamentTeamId = stocks[0].tournamentTeamId;
      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId, {transaction: t});
      const team = await Team.findByPk(tournamentTeam.teamId, {transaction: t});

      for(const stock of stocks) {
        await stock.update({
          offerExpiresAt: null,
          price: null,
          tradableTeams: null
        }, {transaction: t});
      }

      const transactionAmount = stockIds.length * pricePerStock;

      await entry.update({
        secondaryMarketCashSpent: entry.secondaryMarketCashSpent - transactionAmount
      }, {transaction: t});

      await receivingEntry.update({
        secondaryMarketCashSpent: receivingEntry.secondaryMarketCashSpent + transactionAmount
      }, {transaction: t});

      const transactionGroupId = uuidv4();
      let transactionCounter = 0;
      for(let i = 0; i < stockIds.length; i++) {
        transactionCounter += 1;
        if(pricePerStock === 0) {
          await Transaction.create({
            quantity: 1,
            cost: 0,
            stockId: stockIds[i],
            entryId: receivingEntryId,
            groupId: transactionGroupId
          }, {transaction: t});
        } else {
          await Transaction.create({
            quantity: 1,
            cost: pricePerStock * -1,
            stockId: stockIds[i],
            entryId,
            groupId: transactionGroupId
          }, {transaction: t});
  
          await Transaction.create({
            quantity: 1,
            cost: pricePerStock,
            stockId: stockIds[i],
            entryId: receivingEntryId,
            groupId: transactionGroupId
          }, {transaction: t});
        }
      }

      if(transactionCounter > 0) {
        const plural = transactionCounter > 1 ? 's' : '';
        let sellerMessage;
        let receivingMessage;

        if(pricePerStock > 0) {
          sellerMessage = `You sold ${transactionCounter} share${plural} of ${team.name} to ${receivingEntry.name} for $${pricePerStock} per share`;
          receivingMessage = `You bought ${transactionCounter} share${plural} of ${team.name} from ${entry.name} for $${pricePerStock} per share`;
        } else {
          sellerMessage = `You traded ${transactionCounter} share${plural} of ${team.name} to ${receivingEntry.name}`;
          receivingMessage = `You received ${transactionCounter} share${plural} of ${team.name} from ${entry.name}`;
        }
    
        const userEntries = await UserEntry.findAll({
          where: {
            entryId
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
            entryId: receivingEntryId
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
          await sendEmail(email, 'Trade Notification', receivingMessage)
        }
      }

      return entry;
    });

    return result;
  }
};

module.exports = StockService;
