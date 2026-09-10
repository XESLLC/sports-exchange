const { transformCommentsToDescriptions } = require('graphql-tools');
const Tournament = require('../models/Tournament');
const TournamentTeam = require('../models/TournamentTeam')
const Stock = require('../models/Stock')
const Team = require('../models/Team')
const { v4: uuidv4 } = require('uuid');
const League = require('../models/League');
const Entry = require('../models/Entry');
const Transaction = require('../models/Transaction');
const StandingsService = require('./StandingsService');
const { assertTournamentTradingOpen } = require('../util/tournamentStatus');

// Matches the spreadsheet's payout structure: each milestone gets a
// percentage of the tournament's total invested pool. These are the
// defaults from the 2025 sheet - admins can override per-tournament via
// updateMilestonePoolPercent, stored in Tournament.settings.milestones.
// poolPercent is a milestone's TOTAL share of the tournament pool. The
// per-slot payout is poolPercent * pot / slotCount, where slotCount is the
// number of qualifying units for a full season (272 regular-season wins,
// 8 division titles, 2 conference #1 seeds, etc). Admins override both
// per-tournament via updateMilestoneConfig, stored in
// Tournament.settings.milestones.
const DEFAULT_MILESTONE_POOL_PERCENTS = {
  '1': 0.54,  // Reg Season Wins - split across every regular-season win
  '2': 0.40,  // Division Title - 8 winners share this (was 5% each = 40%)
  '3': 0.06,  // Conf #1 Seed - 2 winners share this (was 3% each = 6%)
  '4': 0.01,  // Divisional Round
  '5': 0.025, // Conference Finals
  '6': 0.06,  // Conference Champ
  '7': 0.15   // SB Champ
};

// Number of qualifying "slots" per milestone for a full season. The
// milestone pool is divided evenly across these. Admins adjust this to
// handle ties (e.g. a tied regular-season game drops slot 1 to 271) or
// a change in playoff format.
const DEFAULT_MILESTONE_SLOT_COUNTS = {
  '1': 272, // regular-season games = 32 teams * 17 games / 2 (= total wins, absent ties)
  '2': 8,   // division winners
  '3': 2,   // conference #1 seeds
  '4': 8,   // divisional round teams
  '5': 4,   // conference finalists
  '6': 2,   // conference champions
  '7': 1    // Super Bowl champion
};

const DEFAULT_MILESTONE_NAMES = {
  '1': 'Reg Season Wins',
  '2': 'Division Title',
  '3': 'Conf #1 Seed',
  '4': 'Divisional Round',
  '5': 'Conference Finals',
  '6': 'Conference Champ',
  '7': 'SB Champ'
};

function getMilestonePoolPercent(tournament, milestoneId) {
  const milestones = (tournament.settings && tournament.settings.milestones) || [];
  const configured = milestones.find(m => String(m.id) === String(milestoneId));
  if (configured && typeof configured.poolPercent === 'number') {
    return configured.poolPercent;
  }
  return DEFAULT_MILESTONE_POOL_PERCENTS[String(milestoneId)] || 0;
}

function getMilestoneSlotCount(tournament, milestoneId) {
  const milestones = (tournament.settings && tournament.settings.milestones) || [];
  const configured = milestones.find(m => String(m.id) === String(milestoneId));
  if (configured && typeof configured.slotCount === 'number' && configured.slotCount > 0) {
    return configured.slotCount;
  }
  return DEFAULT_MILESTONE_SLOT_COUNTS[String(milestoneId)] || 1;
}

// Per-slot payout for a milestone: its total pool share divided evenly
// across its full-season slot count. Regular-season wins (milestone 1)
// floor to the cent per win; the flat-bonus milestones round to the cent.
function getMilestonePerSlotPayout(tournament, milestoneId, totalPot) {
  const poolPercent = getMilestonePoolPercent(tournament, milestoneId);
  const slotCount = getMilestoneSlotCount(tournament, milestoneId);
  if (slotCount <= 0) return 0;
  const raw = (poolPercent * totalPot) / slotCount;
  return String(milestoneId) === '1' ? roundDown2(raw) : round2(raw);
}

function roundDown2(value) {
  return Math.floor(value * 100) / 100;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function computeTotalPoolInvested(entries) {
  return entries.reduce((sum, entry) => sum + (entry.ipoCashSpent || 0), 0);
}

async function getDividendPreviewContext(tournamentId) {
  const tournament = await Tournament.findByPk(tournamentId);
  if (!tournament) {
    throw new Error(`tournament not found for id: ${tournamentId}`);
  }

  const tournamentTeams = await TournamentTeam.findAll({
    where: { tournamentId }
  });
  if (!tournamentTeams || tournamentTeams.length < 1) {
    throw new Error(`No tournament teams found for tournament: ${tournamentId}`);
  }

  const teamIds = tournamentTeams.map(tt => tt.teamId);
  const teams = await Team.findAll({ where: { id: teamIds } });
  const teamsById = new Map(teams.map(team => [team.id, team]));

  const entries = await Entry.findAll({ where: { tournamentId } });
  const totalPoolInvested = computeTotalPoolInvested(entries);

  const standingsByTeamName = await StandingsService.fetchNflStandings();

  return { tournament, tournamentTeams, teamsById, totalPoolInvested, standingsByTeamName };
}

// Matches each tournament team to its live standings record. Shared by all
// milestone preview functions below.
function matchTeamsToStandings(tournamentTeams, teamsById, standingsByTeamName) {
  return tournamentTeams.map((tournamentTeam) => {
    const team = teamsById.get(tournamentTeam.teamId);
    const teamName = team ? team.name : null;
    const standing = teamName ? standingsByTeamName.get(teamName) : null;

    return {
      tournamentTeamId: tournamentTeam.id,
      teamId: tournamentTeam.teamId,
      teamName,
      matched: !!standing,
      standing
    };
  });
}

const TournamentService = {
  // Lets an admin override a milestone's total pool share (poolPercent)
  // and/or its full-season slot count, per tournament. Backfills every
  // milestone with its defaults the first time this is called for a
  // tournament, so the settings JSON always ends up with a complete,
  // explicit list rather than partial data.
  updateMilestoneConfig: async (tournamentId, milestoneId, { poolPercent, slotCount } = {}) => {
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) {
      throw new Error(`tournament not found for id: ${tournamentId}`);
    }
    assertTournamentTradingOpen(tournament);

    const existingMilestones = (tournament.settings && tournament.settings.milestones) || [];
    const milestonesById = new Map(existingMilestones.map(m => [String(m.id), m]));

    // Ensure every known milestone is represented so the admin page always
    // has a full picture, not just the one being edited.
    Object.keys(DEFAULT_MILESTONE_POOL_PERCENTS).forEach((id) => {
      const existing = milestonesById.get(id);
      milestonesById.set(id, {
        id,
        name: (existing && existing.name) || DEFAULT_MILESTONE_NAMES[id] || null,
        poolPercent: existing && typeof existing.poolPercent === 'number'
          ? existing.poolPercent
          : DEFAULT_MILESTONE_POOL_PERCENTS[id],
        slotCount: existing && typeof existing.slotCount === 'number' && existing.slotCount > 0
          ? existing.slotCount
          : DEFAULT_MILESTONE_SLOT_COUNTS[id]
      });
    });

    const target = milestonesById.get(String(milestoneId));
    if (!target) {
      throw new Error(`Unknown milestoneId: ${milestoneId}`);
    }
    if (typeof poolPercent === 'number') {
      target.poolPercent = poolPercent;
    }
    if (typeof slotCount === 'number' && slotCount > 0) {
      target.slotCount = slotCount;
    }
    milestonesById.set(String(milestoneId), target);

    tournament.settings = {
      ...tournament.settings,
      milestones: Array.from(milestonesById.values())
    };
    // Sequelize doesn't deep-track JSON column mutations, so mark it dirty explicitly.
    tournament.changed('settings', true);
    await tournament.save();

    return tournament;
  },
  // Back-compat wrapper - older callers that only set the pool percent.
  updateMilestonePoolPercent: async (tournamentId, milestoneId, poolPercent) => {
    return TournamentService.updateMilestoneConfig(tournamentId, milestoneId, { poolPercent });
  },
  // Computes each team's milestone dividend from the results an admin
  // entered (regular-season wins, or an achieved flag for the flat-bonus
  // milestones) and writes them to TournamentTeam.milestoneData. The dollar
  // amounts are derived here from the milestone's pool share and slot count
  // so a client can never push its own numbers. Payout math downstream
  // (EntryService.portfolioSummaries) still just reads dividendPrice.
  saveMilestoneResults: async (tournamentId, milestoneId, milestoneName, teamResults) => {
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) {
      throw new Error(`tournament not found for id: ${tournamentId}`);
    }
    assertTournamentTradingOpen(tournament);

    const entries = await Entry.findAll({ where: { tournamentId } });
    const totalPot = computeTotalPoolInvested(entries);
    const perSlot = getMilestonePerSlotPayout(tournament, milestoneId, totalPot);
    const isRegSeason = String(milestoneId) === '1';
    const index = parseInt(milestoneId, 10) - 1;
    const resolvedName = milestoneName || DEFAULT_MILESTONE_NAMES[String(milestoneId)] || `Milestone ${milestoneId}`;

    for (const teamResult of teamResults) {
      const tournamentTeam = await TournamentTeam.findByPk(teamResult.tournamentTeamId);
      if (!tournamentTeam || String(tournamentTeam.tournamentId) !== String(tournamentId)) {
        throw new Error(`tournament team not found for id: ${teamResult.tournamentTeamId}`);
      }

      const wins = teamResult.wins || 0;
      const achieved = !!teamResult.achieved;
      const dividendPrice = isRegSeason
        ? round2(wins * perSlot)
        : (achieved ? perSlot : 0);

      const milestoneEntry = {
        milestoneId: String(milestoneId),
        milestoneName: resolvedName,
        dividendPrice,
        wins,
        losses: teamResult.losses || 0,
        ties: teamResult.ties || 0,
        achieved
      };

      const data = tournamentTeam.milestoneData ? [...tournamentTeam.milestoneData] : [];
      if (data.length > index) {
        data.splice(index, 1, milestoneEntry);
      } else {
        data.splice(index, 0, milestoneEntry);
      }
      tournamentTeam.milestoneData = data;
      tournamentTeam.changed('milestoneData', true);
      await tournamentTeam.save();
    }

    return tournament;
  },
  // Fetches live NFL standings and computes what each team's regular-season
  // dividend WOULD be, using this tournament's own invested pool.
  // Read-only - does not write anything to the DB. The admin reviews the
  // result (in MilestoneForm) and saves it explicitly, same as manual entry.
  previewRegularSeasonDividends: async (tournamentId) => {
    const { tournament, tournamentTeams, teamsById, totalPoolInvested, standingsByTeamName } =
      await getDividendPreviewContext(tournamentId);

    const matched = matchTeamsToStandings(tournamentTeams, teamsById, standingsByTeamName);
    const matchedTeams = matched.map(t => ({
      tournamentTeamId: t.tournamentTeamId,
      teamId: t.teamId,
      teamName: t.teamName,
      matched: t.matched,
      wins: t.standing ? t.standing.wins : 0,
      losses: t.standing ? t.standing.losses : 0,
      ties: t.standing ? t.standing.ties : 0
    }));

    const unmatchedTeamNames = matchedTeams.filter(t => !t.matched).map(t => t.teamName);

    // Wins so far across matched teams - informational only now, so the
    // admin can see how much of the season has been played before saving.
    const totalLeagueWins = matchedTeams
      .filter(t => t.matched)
      .reduce((sum, t) => sum + t.wins, 0);

    // Each tie game removes one leaguewide win from the season total, so
    // surface the count and a suggested slot value.
    const totalTies = matchedTeams
      .filter(t => t.matched)
      .reduce((sum, t) => sum + t.ties, 0);
    const tieGames = Math.round(totalTies / 2);

    // Per-win rate is the milestone's pool share spread across the FULL
    // season's win slots (default 272), not the wins played to date - so
    // running this mid-season accrues value instead of paying the whole
    // pool out early. Admins adjust slotCount for ties.
    const slotCount = getMilestoneSlotCount(tournament, '1');
    const perWinRate = getMilestonePerSlotPayout(tournament, '1', totalPoolInvested);

    const teamsWithDividends = matchedTeams.map(t => ({
      ...t,
      dividendPrice: round2(t.wins * perWinRate)
    }));

    return {
      totalPoolInvested: round2(totalPoolInvested),
      totalLeagueWins,
      slotCount,
      tieGames,
      perWinRate,
      unmatchedTeamNames,
      teams: teamsWithDividends
    };
  },
  // Division Title (milestone '2'): a flat poolPercent-of-pot bonus to the
  // team with the best win% in each division, per your MASTER sheet's
  // "per team, not split" pattern (same as Conf #1 Seed below).
  previewDivisionTitleDividends: async (tournamentId) => {
    const { tournament, tournamentTeams, teamsById, totalPoolInvested, standingsByTeamName } =
      await getDividendPreviewContext(tournamentId);

    const matched = matchTeamsToStandings(tournamentTeams, teamsById, standingsByTeamName);
    const unmatchedTeamNames = matched.filter(t => !t.matched).map(t => t.teamName);

    // Find the division winner (highest win%, tie-broken by wins) among
    // MATCHED teams, grouped by ESPN's divisionName.
    const byDivision = new Map();
    matched.filter(t => t.matched).forEach((t) => {
      const key = t.standing.divisionName;
      const current = byDivision.get(key);
      if (!current
        || t.standing.winPercent > current.standing.winPercent
        || (t.standing.winPercent === current.standing.winPercent && t.standing.wins > current.standing.wins)) {
        byDivision.set(key, t);
      }
    });
    const winnerTournamentTeamIds = new Set(
      Array.from(byDivision.values()).map(t => t.tournamentTeamId)
    );

    const poolPercent = getMilestonePoolPercent(tournament, '2');
    const slotCount = getMilestoneSlotCount(tournament, '2');
    const flatBonus = getMilestonePerSlotPayout(tournament, '2', totalPoolInvested);

    const teams = matched.map(t => ({
      tournamentTeamId: t.tournamentTeamId,
      teamId: t.teamId,
      teamName: t.teamName,
      matched: t.matched,
      achieved: winnerTournamentTeamIds.has(t.tournamentTeamId),
      dividendPrice: winnerTournamentTeamIds.has(t.tournamentTeamId) ? flatBonus : 0
    }));

    return {
      totalPoolInvested: round2(totalPoolInvested),
      poolPercent,
      slotCount,
      flatBonus,
      unmatchedTeamNames,
      teams
    };
  },
  // Conf #1 Seed (milestone '3'): a flat poolPercent-of-pot bonus to
  // whichever team ESPN currently has as the #1 playoff seed in each
  // conference (only 2 teams league-wide: 1 AFC + 1 NFC).
  previewConfSeed1Dividends: async (tournamentId) => {
    const { tournament, tournamentTeams, teamsById, totalPoolInvested, standingsByTeamName } =
      await getDividendPreviewContext(tournamentId);

    const matched = matchTeamsToStandings(tournamentTeams, teamsById, standingsByTeamName);
    const unmatchedTeamNames = matched.filter(t => !t.matched).map(t => t.teamName);

    const seed1TournamentTeamIds = new Set(
      matched.filter(t => t.matched && t.standing.playoffSeed === 1).map(t => t.tournamentTeamId)
    );

    const poolPercent = getMilestonePoolPercent(tournament, '3');
    const slotCount = getMilestoneSlotCount(tournament, '3');
    const flatBonus = getMilestonePerSlotPayout(tournament, '3', totalPoolInvested);

    const teams = matched.map(t => ({
      tournamentTeamId: t.tournamentTeamId,
      teamId: t.teamId,
      teamName: t.teamName,
      matched: t.matched,
      achieved: seed1TournamentTeamIds.has(t.tournamentTeamId),
      dividendPrice: seed1TournamentTeamIds.has(t.tournamentTeamId) ? flatBonus : 0
    }));

    return {
      totalPoolInvested: round2(totalPoolInvested),
      poolPercent,
      slotCount,
      flatBonus,
      unmatchedTeamNames,
      teams
    };
  },
  createOrUpdateMilestoneData: async (id, milestoneInput) => {
    const tournamentTeam = await TournamentTeam.findByPk(id);
    if(!tournamentTeam) {
      throw new Error(`tournament team not found for id: ${id}`)
    }

    const tournament = await Tournament.findByPk(tournamentTeam.tournamentId);
    assertTournamentTradingOpen(tournament);

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

    const allTransactions = await Promise.all(
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

    const result = allTransactions.reduce((result, transaction) => {
      if(result) {
        const foundIndex = result.findIndex(_transaction =>  _transaction.groupId === transaction.groupId && _transaction.entryId === transaction.entryId);
        if(foundIndex >= 0) {
          result[foundIndex].quantity += transaction.quantity;
          return result;
        }
      }

      result.push(transaction);
      return result;
    }, [])

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
  createTournamentTeam: async (price, seed, region, teamId, tournamentId) => {
      let tournamentTeam
      try {
          [tournamentTeam, created] = await TournamentTeam.findOrCreate({
            where: {
                teamId: teamId,
                tournamentId: tournamentId
            },
            defaults: {
                price: price,
                seed: seed,
                region
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
  updateTournamentTeam: async (price, seed, region, teamId, tournamentId) => {
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
    tournamentTeam.region = region;

    await tournamentTeam.save();

    return tournamentTeam;
  },
  // Lets an admin build out (or add to) a tournament's field of teams,
  // mixing teams the league already knows about with brand-new ones - e.g.
  // NCAA tournament schools making their first appearance. Each entry needs
  // exactly one of existingTeamId/newTeamName. Safe to call more than once
  // for the same tournament: a team that's already attached just gets its
  // seed/region/price updated rather than erroring or duplicating, so an
  // admin can re-run this to fix a mistake or add late entries (e.g. First
  // Four results) without disturbing teams already set up.
  setupTournamentTeams: async (tournamentId, entries) => {
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) {
      throw new Error(`tournament not found for id: ${tournamentId}`);
    }

    entries.forEach((entry) => {
      const hasExisting = !!entry.existingTeamId;
      const hasNew = !!(entry.newTeamName && entry.newTeamName.trim());
      if (hasExisting === hasNew) {
        throw new Error(
          `Each team entry needs exactly one of existingTeamId or newTeamName (got: ${JSON.stringify(entry)})`
        );
      }
    });

    const results = await Promise.all(entries.map(async (entry) => {
      let team;
      if (entry.existingTeamId) {
        // Scoped to this tournament's league so a team can't accidentally
        // get attached from a different sport/league by a stray id.
        team = await Team.findOne({
          where: { id: entry.existingTeamId, leagueId: tournament.leagueId }
        });
        if (!team) {
          throw new Error(
            `Team ${entry.existingTeamId} was not found in this tournament's league.`
          );
        }
      } else {
        // findOrCreate on (name, leagueId) means retyping an existing
        // team's exact name re-attaches that team instead of duplicating it.
        [team] = await Team.findOrCreate({
          where: { name: entry.newTeamName.trim(), leagueId: tournament.leagueId }
        });
      }

      const [tournamentTeam] = await TournamentTeam.findOrCreate({
        where: { teamId: team.id, tournamentId },
        defaults: {
          price: entry.price || 0,
          seed: entry.seed || 0,
          region: entry.region || null,
          isEliminated: false
        }
      });

      // findOrCreate leaves an already-existing row untouched - apply any
      // edited seed/region/price so re-running this acts like a real upsert.
      if (entry.price != null) { tournamentTeam.price = entry.price; }
      if (entry.seed != null) { tournamentTeam.seed = entry.seed; }
      if (entry.region != null) { tournamentTeam.region = entry.region; }
      await tournamentTeam.save();

      const stocksInCirculation = await Stock.findAll({
        where: { tournamentTeamId: tournamentTeam.id }
      });
      const numStocksInCirculation = stocksInCirculation.length ? stocksInCirculation.length : 1;

      return {
        id: tournamentTeam.id,
        teamId: team.id,
        teamName: team.name,
        seed: tournamentTeam.seed,
        ipoPrice: tournamentTeam.price,
        region: tournamentTeam.region,
        tournament: tournament.name,
        isEliminated: tournamentTeam.isEliminated,
        milestoneData: tournamentTeam.milestoneData,
        numStocksInCirculation
      };
    }));

    return results;
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
  },
  updateTournamentStatus: async (tournamentId, status) => {
    const VALID_STATUSES = ['active', 'inactive', 'closed'];
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid tournament status: ${status}`);
    }

    const tournament = await Tournament.findByPk(tournamentId);
    if(!tournament) {
      throw new Error(`tournament not found for id: ${tournamentId}`);
    }

    tournament.status = status;
    await tournament.save();

    return tournament;
  },
  getTotalPot: async (tournamentId) => {
    const entries = await Entry.findAll({ where: { tournamentId } });
    return computeTotalPoolInvested(entries);
  },
  // uploadFile: async (tournamentId, sheetType, file) => {
  //   aws.config.update({
  //     accessKeyId: process.env.AWSAccessKeyId,
  //     secretAccessKey: process.env.AWSSecretKey,
  //     region: process.env.AWSRegion
  //   });
  //   const tournament = await Tournament.findByPk(tournamentId);
  //   if(!tournament) {
  //     throw new Error(`tournament not found for id: ${tournamentId}`);
  //   }

  //   const s3 = new aws.S3()

  //   const { createReadStream, filename, mimetype, encoding } = file;

  //   const { Location } = await s3.upload({
  //     Body: createReadStream(),
  //     Key: Date.now().toString() + filename ,
  //     ContentType: mimetype
  //   });


  //   return tournament;
  // }
};

module.exports = TournamentService;
