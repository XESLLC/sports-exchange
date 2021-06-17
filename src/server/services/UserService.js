const { transformCommentsToDescriptions } = require('graphql-tools');
const Tournament = require('../models/Tournament');
const TournamentTeam = require('../models/TournamentTeam')
const Team = require('../models/Team')
const Stock = require('../models/Stock')
const StockUser = require('../models/StockUser')
const User = require('../models/User')
const { v4: uuidv4 } = require('uuid');

const UserService = {
  users: async () => {
    return await User.findAll();
  },

  user: async id => {
    return await User.findOne({
      where: {
        id
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
  createTournamentUser: async (tournamentId, firstname, lastname, email) => {
      let user
      let created
      try {
          [user, created] = await User.findOrCreate({
              where: {
                  email: email,
                  tournamentId: tournamentId
              },
              defaults: {
                  firstname: firstname,
                  lastname: lastname
              }
          });
      } catch (error) {
          console.error("User for Tournament was not created.", error);
          throw new Error("User for Tournament was not created.");
      }
      return user
  },
  ipoPurchase: async (tournamentTeamId, quantity, authUser) => {
      let tournamentTeamStock = {}
      console.log('here')
      try {
          // TODO: setup transaction roll backs
          const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
          const ipoPrice = tournamentTeam.price
          const team = await Team.findByPk(tournamentTeam.teamId)

          tournamentTeamStock.teamName = team.name;
          tournamentTeamStock.price = ipoPrice;
          tournamentTeamStock.quantity = quantity;
console.log('here2')
          const user = await User.findOne({
              where: {
                 email: authUser.email,
                 tournamentId: tournamentTeam.tournamentId
              }
          })
          console.log('here3')
          console.log(user, ipoPrice*quantity)
          if (user.cash < ipoPrice*quantity) {
              console.error("User does not have enough cash.", error);
              throw new Error("User does not have enough cash.");
          }
          user.cash -= (ipoPrice*quantity)
          await user.save();

          for (let i = 0; i < quantity; i++) {
              const stock = await Stock.create({
                  price: null,
                  tournamentTeamId: tournamentTeamId
              })
              const stockUser = await StockUser.create({
                  userId: user.id,
                  stockId: stock.id
              })
          }
      } catch (error) {
          console.error("Failed to purchase IPO.", error);
          throw new Error("Failed to purchase IPO.");
      }
      return tournamentTeamStock
  }
};

module.exports = UserService;
