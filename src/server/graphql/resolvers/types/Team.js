const TeamService = require('../../../services/TeamService');

const Team = {
  Query: {
    teams: () => TeamService.teams(),

    team: (obj, { id }) => TeamService.team(id)
  },

  Mutation: {
    createTeam: async (_, { input }) => {
      const { name, leagueId } = input;
      const team = await TeamService.createTeam(name, leagueId);
      return team;
    },

    addTeamToTournament: async (_, { input }) => {
      const { teamId, tournamentId } = input;
      const team = await TeamService.addTeamToTournament(teamId, tournamentId);
      return team;
    }
  }
};

module.exports = Team;
