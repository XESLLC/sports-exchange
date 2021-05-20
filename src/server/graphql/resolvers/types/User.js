// const StockService = require('../../../services/StockService');
// const { tournament } = require('../../../services/TournamentService');

const User = {
  // Query: {
  //   // User: (obj, input, ctx) => UserService.User(id)
  // },

  Mutation: {
    // In the context of a specific user
    ipoPurchase: async (_, input) => {
      console.log('ipoPurchase input: ', input);
      return true;
    }
  },

  User: {
    // Return list of stocks owned by a user
    stocks: User => {
      return [1, 2, 3];
      // return StockService.getStocksByUserId(User.id);
    }
  }
};

module.exports = User;
