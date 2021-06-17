const League = require('../models/League');

const LeagueService = {
  leagues: async (_, input, ctx) => {
    return await League.findAll();
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
