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

  createTeam: async (name, leagueId) => {
    let id;

    try {
      const team = await Team.findOne({
        where: {
          name
        }
      });
  
      if (team !== null) {
        throw new Error("Team already exists: " + name);
      }
      
      id = uuidv4();

      await Team.create({
        id,
        name,
        leagueId
      });
    } catch (error) {
      console.error("Error creating team: ", error);
      id = null;
    }

    return id;
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
