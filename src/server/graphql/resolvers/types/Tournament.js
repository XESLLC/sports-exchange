const TournamentService = require('../../../services/TournamentService');

const Tournament = {
  Query: {
    getTournamentsByLeagueId: async (_, input) => {
      const leagueId = input.leagueId;
      const tournaments = await TournamentService.tournaments(leagueId);
      return tournaments;
    },
    getTournamentTransactions: async (_, input) => {
      const tournamentId = input.tournamentId;
      const transactions = await TournamentService.getTournamentTransactions(tournamentId);
      return transactions;
    },
    tournaments: async () => {
      const tournaments = await TournamentService.tournaments();
      return tournaments;
    },
    tournament: async (_, input) => {
      const id = input.id;
      const tournament = await TournamentService.tournament(id);
      return tournament;
    }
  },

  Mutation: {
    createOrUpdateMilestoneData: async (_, { input }) => {
      const { id, milestoneInput } = input;
      const tournamentTeam = await TournamentService.createOrUpdateMilestoneData(id, milestoneInput);
      return tournamentTeam;
    },
    createTournament: async (_, { input }) => {
      const { name, leagueId } = input;
      const tournament = await TournamentService.createTournament(name, leagueId);
      return tournament;
    },
    createTournamentTeam: async (_, { input }) => {
      const { price, seed, teamId, tournamentId } = input;
      const tournamentTeam = await TournamentService.createTournamentTeam(price, seed, teamId, tournamentId);
      return tournamentTeam;
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
    },
    toggleIsIpoOpen: async (_, input) => {
      const tournamentId = input.tournamentId;
      const isIpoOpen = input.isIpoOpen;
      const tournament = await TournamentService.toggleIsIpoOpen(tournamentId, isIpoOpen);
      return tournament;
    },
    toggleIsTournamentActive: async (_, input) => {
      const tournamentId = input.tournamentId;
      const isActive = input.isActive;
      const tournament = await TournamentService.toggleIsTournamentActive(tournamentId, isActive);
      return tournament;
    },
    updateTournamentTeam: async (_, { input }) => {
      const { price, seed, teamId, tournamentId } = input;
      const tournamentTeam = await TournamentService.updateTournamentTeam(price, seed, teamId, tournamentId);
      return tournamentTeam;
    },
    toggleTournamentTeamEliminated: async (_, input) => {
      const tournamentTeamId = input.tournamentTeamId;
      const isEliminated = input.isEliminated;
      const tournamentTeam = await TournamentService.toggleTournamentTeamEliminated(tournamentTeamId, isEliminated);
      return tournamentTeam;
    },
    // uploadFile: async (_, input) => {
    //   const tournamentId = input.tournamentId;
    //   const sheetType = input.sheetType;
    //   const file = input.file;
    //   const tournament = await TournamentService.uploadFile(tournamentId, sheetType, file);
    //   return tournament;
    // }
  }
};

module.exports = Tournament;
