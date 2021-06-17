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
    deleteTeam: async (_, args) => {
      const name = args.name
      const leagueId = args.leagueId
      const deleteStatus = await TeamService.deleteTeam(name, leagueId);
      return deleteStatus;
    },
    addTeamToTournament: async (_, { input }) => {
      const { teamId, tournamentId } = input;
      const team = await TeamService.addTeamToTournament(teamId, tournamentId);
      return team;
    }
  }
};

module.exports = Team;
