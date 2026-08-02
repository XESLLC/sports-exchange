const UserService = require('../../../services/UserService');

const User = {
  Query: {
    user: async (_, input) => {
      const email = input.email;
      const user = await UserService.user(email);
      return user;
    },
    users: async (_, __, context) => {
      const authUser = context.user;
      if (!authUser) throw new Error("Unauthorized");
      return await UserService.users();
    },
    usersByEntryId: async (_, input) => {
      const entryId = input.entryId;
      const users = await UserService.usersByEntryId(entryId);
      return users;
    }
  },

  Mutation: {
    updateUserCash: async (_, { userId, cash }, context) => {
      const authUser = context.user;
      const isUpdated = await UserService.updateUserCash(userId, cash);
      return isUpdated;
    },
    createUser: async (_, { input }) => {
      const { firstname, lastname, cash, email, username, phoneNumber } = input;
      const user = await UserService.createUser(firstname, lastname, cash, email, username, phoneNumber);
      return user;
    },
    updateUser: async (_, { input }) => {
      const { firstname, lastname, email, username, phoneNumber, notifyOnMessageBoard } = input;
      const user = await UserService.updateUser(firstname, lastname, email, username, phoneNumber, notifyOnMessageBoard);
      return user;
    },
    setUserAdmin: async (_, { email, isAdmin }, context) => {
      return await UserService.setUserAdmin(email, isAdmin);
    }
  }
};

module.exports = User;
