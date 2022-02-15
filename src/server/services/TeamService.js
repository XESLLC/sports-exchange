const { transformCommentsToDescriptions } = require('graphql-tools');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const TournamentTeam = require('../models/TournamentTeam');
const { v4: uuidv4 } = require('uuid');

const TeamService = {
  tournamentTeams: async (tournamentId) => {
      const tournamentTeams = await TournamentTeam.findAll({
          where: {
            tournamentId: tournamentId
          }
      });

      console.log("team: " + JSON.stringify(tournamentTeams[0]))

      const tournamentTeamsMap = tournamentTeams.map(async (tournamentTeam) => {

          const team = await Team.findOne({
              where: {
                id: tournamentTeam.teamId
              }
          })

          const tournament = await Tournament.findOne({
              where: {
                  id: tournamentId
              }
          })

          return {
              id: tournamentTeam.id,
              teamId: team.id,
              teamName: team.name,
              seed: tournamentTeam.seed,
              ipoPrice: tournamentTeam.price,
              tournament: tournament.name,
              isEliminated: tournamentTeam.isEliminated,
              milestoneData: tournamentTeam.milestoneData
          }
      })
      return tournamentTeamsMap
  },
  tournamentTeamByTeamId: async (tournamentId, teamId) => {
    const tournamentTeam = await TournamentTeam.findOne({
      where: {
        tournamentId,
        teamId
      }
    });

    const team = await Team.findOne({
      where: {
        id: tournamentTeam.teamId
      }
    });

    const tournament = await Tournament.findOne({
      where: {
        id: tournamentId
      }
    });

    return {
      id: tournamentTeam.id,
      teamId: team.id,
      teamName: team.name,
      seed: tournamentTeam.seed,
      ipoPrice: tournamentTeam.price,
      tournament: tournament.name,
      isEliminated: tournamentTeam.isEliminated,
      milestoneData: tournamentTeam.milestoneData
    }
  },
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
      const team = await Team.findOne({
        where: {
          id: teamId
        }
      });

      // TODO what are the default values for price and seed
      await TournamentTeam.create({
        teamId,
        tournamentId,
        price: 0,
        seed: 0,
        isEliminated: false
      });
      return team;
    } catch (error) {
      console.error("Failed to create TournamentTeam entry: " + error);
      return null;
    }
  }
};

module.exports = TeamService;
