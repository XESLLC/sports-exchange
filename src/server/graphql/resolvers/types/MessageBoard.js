const MessageBoardService = require('../../../services/MessageBoardService');

const MessageBoard = {
  Query: {
    tournamentMessages: async (_, { tournamentId }, context) => {
      const email = context.user && context.user.email;
      const messages = await MessageBoardService.tournamentMessages(tournamentId, email);
      return messages;
    }
  },

  Mutation: {
    createTournamentMessage: async (_, { input }, context) => {
      const email = context.user && context.user.email;
      const { tournamentId, title, body, parentId } = input;
      const message = await MessageBoardService.createTournamentMessage(tournamentId, email, title, body, parentId || null);
      return message;
    }
  }
};

module.exports = MessageBoard;
