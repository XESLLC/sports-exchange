const User = require('../models/User');
const UserEntry = require('../models/UserEntry');
const Entry = require('../models/Entry');
const TournamentTeam = require('../models/TournamentTeam');
const StockEntry = require('../models/StockEntry');
const Team = require('../models/Team');
const Stock = require('../models/Stock');

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