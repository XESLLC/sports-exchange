const UserService = require('../../../services/UserService');
const TournamentService = require('../../../services/TournamentService');


const User = {
  // Query: {
  //   // User: (obj, input, ctx) => UserService.User(id)
  // },

  Mutation: {
      ipoPurchase: async (_, { input }, context ) => {
          const authUser = context.user
          const { tournamentTeamId, quantity } = input;
          const tournamentTeamStock = await UserService.ipoPurchase(tournamentTeamId, quantity, authUser);
          return tournamentTeamStock;
      },
      createTournamentUser: async (_, { input }, context ) => {
          const authUser = context.user
          const email = authUser.email
          const {firstname, lastname, tournamentId } = input; // TODO: camel case names
          const user = await UserService.createTournamentUser(tournamentId, firstname, lastname, email);
          return user;
      },
      updateUserCash: async (_, { userId, cash }, context ) => {
          const authUser = context.user // TODO: check permissions
          const email = authUser.email
          const isUpdated = await UserService.updateUserCash(userId, cash);
          return isUpdated;
      },
  }
};

module.exports = User;
