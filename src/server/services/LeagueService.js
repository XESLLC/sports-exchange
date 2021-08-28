const League = require('../models/League');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');

const LeagueService = {
  importLeague: async (leagueName) => {
    const leagueData = require(`../leagues/${leagueName}.json`);
    if(!leagueData) {
        throw new Error(`Could not load league: ${leagueName}`);
    }
    
    const league = await League.create({
      name: leagueData.name,
      defaultSettings: leagueData.defaultSettings
    });

    const teams = JSON.parse(JSON.stringify(leagueData.teams));

    for(let team of teams) {
      await Team.create({
        leagueId: league.id,
        name: `${team.city} ${team.name}`
      });
    }

    return league;
  },
  leagues: async () => {
    const leagues = await League.findAll();

    const result = await Promise.all(
      leagues.map(async (league) => {
        const defaultSettings = JSON.parse(JSON.stringify(league.defaultSettings));
        const tournaments = await Tournament.findAll({
          where: {
            leagueId: league.id
          }
        });
        console.log(defaultSettings)

        return {
          ...league.toJSON(),
          defaultSettings,
          tournaments
        }
      })
    );

    return result;
  },

  league: async id => {
    return await League.findOne({
      where: {
        id
      }
    });
  },

  createLeague: async name => {
    let league;

    try {
        [league, created] = await League.findOrCreate({
            where: { name: name },
        });
        // TODO: handle the already created Leage 
    } catch (error) {
        console.error("Error creating team: ", error);
    }
    return league;
  }
};

module.exports = LeagueService;
