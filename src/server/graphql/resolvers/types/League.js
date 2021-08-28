const LeagueService = require('../../../services/LeagueService');
const TeamService = require('../../../services/TeamService');
const TournamentService = require('../../../services/TournamentService');

const League = {
  Query: {
    leagues: async () => {
      return await LeagueService.leagues();
    },
    // league: (obj, input, ctx) => LeagueService.league(id)
    league: async (_, input) => {
      const id = input.id;
      const league = await LeagueService.league(id);
      return league;
    }
  },

  Mutation: {
    createLeague: async (_, { input }) => {
      const { name } = input;
      const league = await LeagueService.createLeague(name);
      return league;
    },
    importLeague: async (_, input) => {
      const leagueName = input.leagueName;
      const league = await LeagueService.importLeague(leagueName);
      return league;
    }
  },

  League: {
    teams: league => {
      return TeamService.getTeamsByLeagueId(league.id);
    },
    tournaments: league => {
      return TournamentService.getTournamentsByLeagueId(league.id);
    }
  }
};

module.exports = League;
