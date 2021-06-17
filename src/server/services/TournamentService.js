const { transformCommentsToDescriptions } = require('graphql-tools');
const Tournament = require('../models/Tournament');
const TournamentTeam = require('../models/TournamentTeam')
const Stock = require('../models/Stock')
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
    let tournament;
    try {
       [tournament, created] = await Tournament.findOrCreate({
            where: {
                name: name,
                leagueId: leagueId
            }
      });
    } catch (error) {
      console.error("Error creating Tournament: ", error);
      throw new Error("Failed to create tournament.");
    }
    return tournament;
  },
  createTournamentTeam: async (price, seed, teamId, tournamentId) => {
      let tournamentTeam
      try {
          [tournamentTeam, created] = await TournamentTeam.findOrCreate({
            where: {
                teamId: teamId,
                tournamentId: tournamentId
            },
            defaults: {
                price: price,
                seed: seed
            }
          })
      } catch (error) {
          console.error("Failed to create tournamentTeam.", error);
          throw new Error("Failed to create tournamentTeam.");
      }
      return tournamentTeam.id
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
