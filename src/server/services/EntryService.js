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
    console.log("starting portfolioSummaries at ", new Date())
    let entries
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
    if (!entries && entries.length < 1) {throw new Error('Entries not found')}
    const entryIds = entries.map(entry => entry.id);

    const userEntries = await UserEntry.findAll({
      where: {
          entryId: entryIds
      }
    })
    if (!userEntries && userEntries.length < 1) {throw new Error('userEntries not found')}

    const userIds = userEntries.map(userEntry => userEntry.userId)
    const users = await User.findAll({
      where: {
        id: userIds
      }
    })
    if (!users && users.length < 1) {throw new Error('users not found')}

    const tournamentTeams = await TournamentTeam.findAll({
      where: {
          tournamentId: tournamentId
      }
    })
    if (!tournamentTeams && tournamentTeams.length < 1) {throw new Error('userEntries not found')}
    const tournamentTeamIds = tournamentTeams.map(tournamentTeam => tournamentTeam.id)
    const teamsNotEliminated = tournamentTeams.filter(team => !team.isEliminated)
    const teamsNotEliminatedIds = teamsNotEliminated.map(team => team.id)

    const stocks = await Stock.findAll({
      where: {
        tournamentTeamId: tournamentTeamIds
      }
    });
    if (!stocks && stocks.length < 1) {throw new Error('userEntries not found')}

    const stocksNotEliminated = stocks.filter(stock => {
        return teamsNotEliminatedIds.includes(stock.tournamentTeamId)
    })
    const stocksNotEliminatedIds = stocksNotEliminated.map(stock => stock.id)

    const stockEntries = await StockEntry.findAll({
      where: {
          entryId: entryIds
      }
    })
    if (!stockEntries && stockEntries.length < 1) {throw new Error('userEntries not found')}

    // don't remove this
    // const teamMap = stockEntries.reduce((resultMap, stockEntry) => {
    //     stock = stocks.find(stock => stock.id == stockEntry.stockId)
    //     matchedTournTeam = tournamentTeams.find(team => team.id == stock.tournamentTeamId)
    //     if (resultMap[matchedTournTeam.id]) {
    //         resultMap[matchedTournTeam.id] = resultMap[matchedTournTeam.id] + 1
    //         return resultMap
    //     } else {
    //         resultMap[matchedTournTeam.id] = 1
    //         return resultMap
    //     }
    // }, {})
    //hard coded below to increase speed of resolver

    const teamMap = {
      'c749e0b8-6a98-465a-b125-6e3aed0a6346': 658,
      'c3c6604c-6726-4adc-8d1c-5e894ec17bf3': 903,
      '077f3ff2-38a2-4517-b313-dd25144d2ee9': 667,
      'e61e6356-849b-4786-b2bd-a77f77c74bfd': 427,
      'da2d38fc-97d3-4b65-a173-4f390fab3548': 255,
      'ff17cf65-8e0a-4cbb-8c97-d292afcb6631': 403,
      'a26e0284-5de8-4bb2-8bb2-e0dd96e3235f': 1358,
      '47da00d7-9492-430c-b078-f291932a9da5': 472,
      'c2ee3bfe-bf95-4983-b8f1-8f4472403cea': 853,
      'a78a7a40-2001-445a-bbe0-a2a9d69c7064': 266,
      'd2f4f63a-a93a-40da-a44e-daa906674c20': 467,
      '7df0dccd-b982-4e93-a335-cc1351b3282d': 165,
      'be414eef-9fa2-4032-8903-002fde837307': 534,
      '27f36330-e434-450c-b993-c491250db2e7': 621,
      'e3af3d43-93fb-4b56-b95e-ae1baf3a6e11': 11,
      '9d5a9da0-0a45-4ca3-b2d0-bcea005ef356': 548,
      'ecbd0cc4-4b77-48cd-b4cb-87f913d205a6': 377,
      'cd509e21-cf32-4d83-8845-55fa00fe11da': 432,
      '3f45fd20-0f03-4366-8613-3eeb378ef6d7': 167,
      '4b093674-38aa-4cda-8ebe-d64a5903bcf2': 260,
      '273d8f72-bf22-44a5-807b-5d542a564a66': 1476,
      'af5afc52-eb40-42bf-8aae-803cd31334e8': 107,
      '147fc272-70fe-4d73-9f13-e2826a1ae33a': 619,
      'a8ec1c75-a08f-4b27-9be2-2ff352c4d341': 315,
      'add873d4-0609-4f5d-a0a4-e11b26d7f539': 243,
      '52ed362f-6762-4058-a0ff-c2c9611d1333': 83,
      'd3d0e1a6-8018-4ab6-af6e-5a0bfc33d937': 273,
      'db0d2783-1bb0-4c3e-b8fb-25a2f8fd576b': 820,
      'befefa72-e0e1-4beb-ace7-c4a40799b84d': 864,
      '24879bbb-0d8c-4ee5-86b5-00a88a9fe673': 244,
      'bd549359-13a1-49a5-9c7b-6671fe0f0c83': 182,
      '92eb2c26-4fe6-4cb3-97a7-cf1ea7c4f680': 87,
      '98376461-43f0-47c9-85ad-f2c31ecbea16': 424,
      '8a0f28f6-5c1c-4f14-bcd0-21ec9da1ca16': 423,
      '5b4cb970-744b-4dcc-b921-1733b9a2e268': 584,
      'f4d7687d-b760-48c2-b386-7caf856028f6': 292,
      '08fe0cd5-e278-441f-9cd0-b84c0fcc6d9b': 211,
      '998ca6b0-cd77-4751-be23-c99d15e9be79': 388,
      'bd79c4d3-6f07-4348-8bbf-106377ab1568': 394,
      '5fb9a856-2f52-4405-a168-fe53e00b9feb': 976,
      'ae7cc98f-92aa-40e7-903d-0df15823cfc1': 147,
      '6421d58b-b65a-4c6e-abaf-80fa9a4b8589': 356,
      '7a671b5f-aba0-42b4-88b6-52a7894cd479': 988,
      '4d54dbea-9867-4f5e-ba5c-47b9cee7bb2a': 471,
      'da3a89c0-f5c5-4c2d-bff2-ae76b5d2c682': 430,
      'cb2862e9-9e23-4921-86d6-db15c01df6bf': 182,
      'c2a00621-10db-4fb4-866a-d2f8a1392781': 437,
      'f30f5443-fd37-4e80-8865-9319fad9389d': 359,
      '07946ed1-2379-4b26-8d59-423e1c6f2ba4': 245,
      '6aee9924-d88b-453b-8d44-7e503ec0ad05': 171,
      '56cf2f24-d5e3-4fea-aff7-1d698f610b06': 198,
      'eea0c4ab-6d25-4795-ac61-fedfff642028': 174,
      '0be67dd6-b79b-4233-9991-d664e29d9145': 276,
      '70049f35-3157-4cd5-a2bc-09ac570deec7': 449,
      '45015b9c-4f37-4041-af96-f1164c74513c': 175,
      'c2040731-0720-46e9-8a44-fa0cef7bd48e': 163,
      'cafdfa26-1f14-4c6a-b6bd-c1bfbafa7649': 331,
      '12e7180d-25f7-4797-93be-11e550729c1c': 226,
      '44eae352-8590-4aed-ae90-ab0d76d63fa8': 293,
      '0934bc19-72bf-478f-96d2-e6ae3843ca43': 181,
      '6ba55776-15f3-40b0-8326-55c38843e20e': 60,
      '4b5c5d77-497e-49fc-a65d-df3b30768857': 38,
      '99d44da7-61f7-4404-83e6-5988ffce3cf6': 94,
      '3c4e3b73-fff0-47f9-a222-8448eabc88c1': 1,
      'd5222616-fcdb-4806-9d9d-60f035088fbf': 2,
      '82a7cc12-8298-4eaf-abac-30cf571dda8c': 2,
      'cb736876-cadd-41b8-992c-e1ecb83edbfc': 1,
      'f7442289-62fc-4ddb-85af-7825c34c7d9f': 1
    }

    console.log("Team Map ", teamMap)

    const portfolioSummaries = entries.map((entry) => {
        console.log("Mapping Entries - creating portfolio Summary for >>>> ", entry.id)

        const ipoCashSpent = entry.ipoCashSpent? entry.ipoCashSpent : 0
        const secondaryMarketCashSpent = entry.secondaryMarketCashSpent? entry.secondaryMarketCashSpent : 0

        //combining names for multiple users per entry
        let names = []
        for(let userEntry of userEntries) {
            const user = users.find(_user => userEntry.entryId == entry.id && _user.id == userEntry.userId)
            if (user) {names.push(user.firstname + " " + user.lastname)}
        }
        const combinedNames = names.reduce((result, userName) => {
            if (result.length > 0) {
                return result + " & " + userName
            }
            return userName
        }, "")

        const initialIpoStocks = stocks.filter(stock => stock.originalIpoEntryId == entry.id)

        const stockEntriesOwned = stockEntries.filter(stockEntry => stockEntry.entryId == entry.id)

        const calcResults = stockEntriesOwned.reduce((result, stockEntry) => {
            stock = stocks.find(stock => stock.id == stockEntry.stockId)

            matchedTournTeam = tournamentTeams.find(team => team.id == stock.tournamentTeamId)

            if (!!matchedTournTeam && result.teamsOwned.indexOf(matchedTournTeam.id) === -1) {
                result.teamsOwned.push(matchedTournTeam.id)
            }

            matchedTournTeamAlive = teamsNotEliminated.find(team => team.id == stock.tournamentTeamId)

            if (!!matchedTournTeamAlive) {
                if (result.teamsOwnedInTourn.indexOf(matchedTournTeamAlive.id) === -1) {
                    result.teamsOwnedInTourn.push(matchedTournTeamAlive.id)
                }
                result.stockEntriesRemaining += 1
                result.stockEntriesRemainingMoney += matchedTournTeamAlive.price
            }

            const entryMoney = matchedTournTeam.milestoneData.reduce((moneyEarned, milestone) => {
                moneyEarned += milestone.dividendPrice? milestone.dividendPrice : 0
                return moneyEarned
            }, 0)
            numberOfStocksPerTeam = teamMap[matchedTournTeam.id]

            result.moneyWon += Math.floor((entryMoney/numberOfStocksPerTeam)*100)/100
            return result
        }, {moneyWon: 0, stockEntriesRemaining: 0, teamsOwned: [], teamsOwnedInTourn: [], stockEntriesRemainingMoney: 0 })

        const percentStocksRemaining = stockEntriesOwned.length > 0? Math.round(calcResults.stockEntriesRemaining/stockEntriesOwned.length * 10000)/100 : 0

        const percentMoneyWonInvested = ipoCashSpent > 0? calcResults.moneyWon / ipoCashSpent : 0

        const profitLoss = Math.round((calcResults.moneyWon - ipoCashSpent - secondaryMarketCashSpent)*100)/100

        const percentMoneyRemaining = (ipoCashSpent)? Math.round((calcResults.moneyWon + calcResults.stockEntriesRemainingMoney + secondaryMarketCashSpent)/(ipoCashSpent)  * 100)/ 100 : 0

        return  {
          ownerName: combinedNames,
          entryName: entry.name,
          totalInitialInvestment: ipoCashSpent, // initial ipo investment
          totalInitialStocksOwned: initialIpoStocks.length, //
          totalCurrentStocksOwned: stockEntriesOwned.length, //total owned and eliminated
          stocksRemaining: calcResults.stockEntriesRemaining, //total of whats not eliminated
          percentStocksRemaining: percentStocksRemaining,
          totalCurrentTeamsOwned: calcResults.teamsOwned.length, //number teams owned & may have been eliminated
          totalCurrentTeamsRemaining: calcResults.teamsOwnedInTourn.length , // number of teams that are left in tourn
          moneyWonToDate: Math.floor(calcResults.moneyWon*100)/100,
          percentMoneyWonInvested: Math.round(percentMoneyWonInvested*100)/100,//   money won/ ipo money
          originalMoneyRemaining: Math.round(calcResults.stockEntriesRemainingMoney * 100)/100, //stocks left (at IPO price)
          profitLoss: profitLoss, //money won - ipo - secondary market cash
          percentMoneyRemaining:  percentMoneyRemaining // allMoney/initial Ipo Investment
        }
    })
    console.log("finished Portfolio Summaries at ", new Date())
    return portfolioSummaries
  }
};

module.exports = EntryService;
