const { transformCommentsToDescriptions } = require('graphql-tools');
const Tournament = require('../models/Tournament');
const TournamentTeam = require('../models/TournamentTeam')
const Stock = require('../models/Stock')
const Team = require('../models/Team')
const { v4: uuidv4 } = require('uuid');
const League = require('../models/League');
const Entry = require('../models/Entry');
const Transaction = require('../models/Transaction');

const TournamentService = {
  tournaments: async () => {
    const tournaments = await Tournament.findAll();
    const result = await Promise.all(
      tournaments.map(async(tournament) => {
        const league = await League.findByPk(tournament.leagueId);
        const leagueName = league.name;

        return {
          ...tournament.toJSON(),
          leagueName
        }
      })
    );

    return result;
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
  getTournamentTransactions: async (tournamentId) => {
    const entries = await Entry.findAll({
      where: {
        tournamentId
      }
    });
    const entryIds = entries.map(entry => entry.id);

    const transactions = await Transaction.findAll({
      where: {
        entryId: entryIds
      }
    });

    const result = await Promise.all(
      transactions.map(async (transaction) => {
        const entry = await Entry.findOne({
          where: {
            id: transaction.entryId
          }
        });

        const stock = await Stock.findOne({
          where: {
            id: transaction.stockId
          }
        });

        const tournamentTeam = await TournamentTeam.findOne({
          where: {
            id: stock.tournamentTeamId
          }
        });

        const team = await Team.findOne({
          where: {
            id: tournamentTeam.teamId
          }
        });

        return {
          ...transaction.toJSON(),
          entry,
          teamName: team.name,
          tournamentTeamId: tournamentTeam.id
        }
      })
    );

    return result.sort((a, b) => {
      return b.createdAt - a.createdAt
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
      return tournamentTeam
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
