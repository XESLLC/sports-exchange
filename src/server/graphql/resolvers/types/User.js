const UserService = require('../../../services/UserService');

const User = {
  Query: {
    user: async (_, input) => {
        const email = input.email;
        const user = await UserService.user(email);
        return user;
    },
    usersByEntryId: async (_, input) => {
      const entryId = input.entryId;
      const users = await UserService.usersByEntryId(entryId);
      return users;
  }
  },

  Mutation: {
      updateUserCash: async (_, { userId, cash }, context ) => {
          const authUser = context.user // TODO: check permissions
          const email = authUser.email
          const isUpdated = await UserService.updateUserCash(userId, cash);
          return isUpdated;
      },
      createUser: async (_, { input }) => {
          const { firstname, lastname, cash, email, username, phoneNumber } = input;
          const user = await UserService.createUser(firstname, lastname, cash, email, username, phoneNumber);
          return user;
      }
  }
};

module.exports = User;
