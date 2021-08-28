const TeamService = require('../../../services/TeamService');

const Team = {
  Query: {
    getTeamsByLeagueId: async (_, { leagueId }) => TeamService.getTeamsByLeagueId(leagueId),
    tournamentTeams: async (_, { tournamentId } ) => {
      const arrayOfTournamentTeams = await TeamService.tournamentTeams(tournamentId);
      return arrayOfTournamentTeams;
    },
    tournamentTeamByTeamId: async (_, input) => {
      const tournamentId = input.tournamentId;
      const teamId = input.teamId;
      const tournamentTeams = await TeamService.tournamentTeamByTeamId(tournamentId, teamId);
      return tournamentTeams;
    },
    teams: () => TeamService.teams(),
    team: (obj, { id }) => TeamService.team(id)
  },

  Mutation: {
    createTeam: async (_, { input } ) => {
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
