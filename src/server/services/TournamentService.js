const { transformCommentsToDescriptions } = require('graphql-tools');
const Tournament = require('../models/Tournament');
const { v4: uuidv4 } = require('uuid');

const TournamentService = {
  tournaments: async () => {
    return await Tournament.findAll();
  },

  tournament: async id => {
    return await Tournament.findOne({
      where: {
        id
      }
    });
  },

  getTournamentsByLeagueId: async leagueId => {
    return await Tournament.findAll({
      where: {
        leagueId
      }
    });
  },

  createTournament: async (name, leagueId) => {
    let id;

    try {
      const tournament = await Tournament.findOne({
        where: {
          name
        }
      });
    
      if (tournament !== null) {
        throw new Error("Tournament already exists: " + name);
      }

      id = uuidv4();

      await Tournament.create({
        id,
        name,
        leagueId
      });
    } catch (error) {
      console.error("Error creating team: ", error);
      throw new Error("Failed to create tournament.");
    }

    return id;
  },

  updateTournament: async (id, name, leagueId) => {
    let tournament;

    try {
      tournament = await Tournament.update({ name, leagueId }, {
        where: {
          id
        }
      });

    } catch (error) {
      console.error("Failed to update tournament: ", error);
      throw new Error("Failed to update tournament.");
    }

    return tournament;
  },

  deleteTournament: async id => {
    let tournament;

    try {
      tournament = await Tournament.destroy({
        where: {
          id
        }
      });
    } catch (error) {
      console.error("Failed to delete tournament: ", error);
      throw new Error("Failed to delete tournament.");
    }

    return tournament;
  }
};

module.exports = TournamentService;
