const LeagueService = require('../../../services/LeagueService');
const TeamService = require('../../../services/TeamService');
const TournamentService = require('../../../services/TournamentService');


const League = {
  Query: {
    leagues: (obj, input, ctx) => LeagueService.leagues(obj, input, ctx),
    league: (obj, input, ctx) => LeagueService.league(id)
  },

  Mutation: {
    createLeague: async (_, { input }) => {
      const { name } = input;
      const league = await LeagueService.createLeague(name);
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
