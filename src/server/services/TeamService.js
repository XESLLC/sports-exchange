const { transformCommentsToDescriptions } = require('graphql-tools');
const Team = require('../models/Team');
const TournamentTeam = require('../models/TournamentTeam');
const { v4: uuidv4 } = require('uuid');

const TeamService = {
  teams: async () => {
    return await Team.findAll();
  },

  team: async id => {
    return await Team.findOne({
      where: {
        id
      }
    });
  },

  getTeamsByLeagueId: async leagueId => {
    return await Team.findAll({
      where: {
        leagueId
      }
    });
  },
  deleteTeam: async(name, leagueId) => {
      try {
          await Team.destroy({
             where: {
               name: name,
               leagueId: leagueId
             }
          })
      } catch (error) {
         console.error("Error deleting team: ", error);
         throw new Error('Error deleting team.')
      }
      return 'Success'
  },
  createTeam: async (name, leagueId) => {
    let team;

    try {
       [team, created] = await Team.findOrCreate({
          where: {
              name: name,
              leagueId: leagueId
          }
      });
    } catch (error) {
      console.error("Error creating team: ", error);
    }
    return team;
  },
  addTeamToTournament: async (teamId, tournamentId) => {
    try {
      let tournamentTeam = await TournamentTeam.create({
        teamId,
        tournamentId
      });
      return tournamentTeam.id;
    } catch (error) {
      console.error("Failed to create TournamentTeam entry: " + error);
      return null;
    }
  }
};

module.exports = TeamService;
