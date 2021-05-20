const League = require('../models/League');
const { v4: uuidv4 } = require('uuid');

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
    let id;

    try {
      const league = await League.findOne({
        where: {
          name
        }
      });
  
      if (league !== null) {
        throw new Error("League already exists: " + name);
      }
      
      id = uuidv4();

      await League.create({
        id,
        name
      });
    } catch (error) {
      console.error("Error creating team: ", error);
      id = null;
    }

    return id;
  }
};

module.exports = LeagueService;
