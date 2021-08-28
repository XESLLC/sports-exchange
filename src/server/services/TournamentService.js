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
  createOrUpdateMilestoneData: async (id, milestoneInput) => {
    const tournamentTeam = await TournamentTeam.findByPk(id);
    if(!tournamentTeam) {
      throw new Error(`tournament team not found for id: ${id}`)
    }
    const team = await Team.findByPk(tournamentTeam.teamId);
    if(!team) {
      throw new Error(`team not found for id: ${tournamentTeam.teamId}`)
    }

    if(!tournamentTeam.milestoneData) {
      tournamentTeam.milestoneData = [milestoneInput];
    } else {
      const index = parseInt(milestoneInput.milestoneId) - 1;
      const temp = [...tournamentTeam.milestoneData];
      if(tournamentTeam.milestoneData.length > index) {
        temp.splice(index, 1, milestoneInput);
        tournamentTeam.milestoneData = temp;
      } else {
        temp.splice(index, 0, milestoneInput);
        tournamentTeam.milestoneData = temp;
      }
    }
    await tournamentTeam.save();

    return team;
  },
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
    const tournament = await Tournament.findOne({
      where: {
        id
      }
    });

    console.log("tournament: " + JSON.stringify(tournament))
    return tournament;
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
    const league = await League.findByPk(leagueId);
    if(!league) {
      throw new Error(`Could not find league with id: ${leagueId}`);
    }

    const tournament = await Tournament.create({
      name,
      leagueId,
      isIpoOpen: true,
      settings: league.defaultSettings
    });
    
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
  updateTournamentTeam: async (price, seed, teamId, tournamentId) => {
    const tournamentTeam = await TournamentTeam.findOne({
      where: {
        teamId,
        tournamentId
      }
    });
    if(!tournamentTeam) {
      throw new Error(`Could not find tournament team for teamId: ${teamId}`);
    }

    tournamentTeam.price = price;
    tournamentTeam.seed = seed;

    await tournamentTeam.save();

    return tournamentTeam;
  },
  toggleTournamentTeamEliminated: async (tournamentTeamId, isEliminated) => {
    const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId);
    if(!tournamentTeam) {
      throw new Error(`Could not find tournament team for id: ${tournamentTeamId}`);
    }

    tournamentTeam.isEliminated = isEliminated;
    await tournamentTeam.save();

    return tournamentTeam;
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
  },
  toggleIsIpoOpen: async (tournamentId, isIpoOpen) => {
    const tournament = await Tournament.findByPk(tournamentId);
    if(!tournament) {
      throw new Error(`tournament not found for id: ${tournamentId}`);
    }

    tournament.isIpoOpen = isIpoOpen;
    await tournament.save();

    return tournament;
  }
};

module.exports = TournamentService;
