const { transformCommentsToDescriptions } = require('graphql-tools');
const Tournament = require('../models/Tournament');
const TournamentTeam = require('../models/TournamentTeam')
const Team = require('../models/Team')
const Stock = require('../models/Stock')
const StockUser = require('../models/StockEntry')
const User = require('../models/User')
const { v4: uuidv4 } = require('uuid');
const UserEntry = require('../models/UserEntry');
const Entry = require('../models/Entry');

const UserService = {
  users: async () => {
    return await User.findAll();
  },
  user: async email => {
    return await User.findOne({
      where: {
        email
      }
    });
  },
  updateUserCash: async (userId, cash) => {
      let isUpdated
      try {
          isUpdated = await User.update({cash: cash}, {
              where: {
                  id: userId
              }
          });
      } catch (error) {
          console.error("User for Tournament was not created.", error);
          throw new Error("User for Tournament was not created.");
      }
      return !!isUpdated
  },
  createUser: async (firstname, lastname, cash, email, username, phoneNumber) => {
    let user;
    let created;

    [user, created] = await User.findOrCreate({
      where: {
        email
      },
      defaults: {
        firstname,
        lastname,
        cash,
        email,
        username,
        phoneNumber
      }
    });

    const result = user ? user : created;

    return result;
  },
  usersByEntryId: async (entryId) => {
    const entry = await Entry.findOne({
      where: {
        id: entryId
      }
    });
    if(!entry) {
      throw new Error("Entry not found");
    }

    const userEntries = await UserEntry.findAll({
      where: {
        entryId: entry.id
      }
    });
    if(!userEntries) {
      throw new Error("User entries not found");
    }

    const userIds = userEntries.map(entry => entry.userId);

    const users = await User.findAll({
      where: {
        id: userIds
      }
    });

    return users;
  },
};

module.exports = UserService;
