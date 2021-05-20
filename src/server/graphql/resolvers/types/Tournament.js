const TournamentService = require('../../../services/TournamentService');

const Tournament = {
  Query: {
    tournaments: () => TournamentService.tournaments(),

    tournament: (obj, { id }) => TournamentService.tournament(id)
  },

  Mutation: {
    createTournament: async (_, { input }) => {
      const { name, leagueId } = input;
      const id = await TournamentService.createTournament(name, leagueId);
      return id;
    },

    updateTournament: async (_, { input }) => {
      const { id, name, leagueId } = input;
      const updateId = await TournamentService.updateTournament(id, name, leagueId);
      return updateId;
    },

    deleteTournament: async (_, { input }) => {
      const { id } = input;
      const deleteId = await TournamentService.deleteTournament(id);
      return deleteId;
    }
  }
};

module.exports = Tournament;
