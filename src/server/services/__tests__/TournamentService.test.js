jest.mock('../../models/Tournament');
jest.mock('../../models/TournamentTeam');
jest.mock('../../models/Stock');
jest.mock('../../models/Team');
jest.mock('../../models/League');
jest.mock('../../models/Entry');
jest.mock('../../models/Transaction');
jest.mock('../StandingsService');

const Tournament = require('../../models/Tournament');
const TournamentTeam = require('../../models/TournamentTeam');
const Team = require('../../models/Team');
const Entry = require('../../models/Entry');
const StandingsService = require('../StandingsService');
const TournamentService = require('../TournamentService');

const TOURNAMENT_ID = 'tournament-1';

// Team A: 10 wins, Team B: 5 wins, Team C: has no ESPN match at all.
function setupTournament({ settings = null } = {}) {
  Tournament.findByPk.mockResolvedValue({
    id: TOURNAMENT_ID,
    settings
  });

  TournamentTeam.findAll.mockResolvedValue([
    { id: 'tt-a', teamId: 'team-a', tournamentId: TOURNAMENT_ID },
    { id: 'tt-b', teamId: 'team-b', tournamentId: TOURNAMENT_ID },
    { id: 'tt-c', teamId: 'team-c', tournamentId: TOURNAMENT_ID }
  ]);

  Team.findAll.mockResolvedValue([
    { id: 'team-a', name: 'Kansas City Chiefs' },
    { id: 'team-b', name: 'Las Vegas Raiders' },
    { id: 'team-c', name: 'Team Not On ESPN' }
  ]);

  Entry.findAll.mockResolvedValue([
    { ipoCashSpent: 600 },
    { ipoCashSpent: 400 }
  ]);

  StandingsService.fetchNflStandings.mockResolvedValue(new Map([
    ['Kansas City Chiefs', {
      wins: 10, losses: 4, ties: 0, winPercent: 0.714,
      playoffSeed: 1, conferenceName: 'AFC', divisionName: 'AFC West'
    }],
    ['Las Vegas Raiders', {
      wins: 5, losses: 9, ties: 0, winPercent: 0.357,
      playoffSeed: 0, conferenceName: 'AFC', divisionName: 'AFC West'
    }]
    // 'Team Not On ESPN' intentionally has no standings entry.
  ]));
}

describe('TournamentService dividend payouts (ESPN-hooked)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('previewRegularSeasonDividends', () => {
    it('pulls live ESPN standings and splits the milestone pool across the full-season win slots', async () => {
      setupTournament();

      const result = await TournamentService.previewRegularSeasonDividends(TOURNAMENT_ID);

      expect(StandingsService.fetchNflStandings).toHaveBeenCalledTimes(1);

      // Pool = $1000; milestone 1 defaults to 54% of pool = $540, spread
      // across the FULL season's 272 win slots (not wins played to date).
      // perWinRate = floor((540 / 272) * 100) / 100 = 1.98
      expect(result.totalPoolInvested).toBe(1000);
      expect(result.totalLeagueWins).toBe(15); // informational - wins so far
      expect(result.slotCount).toBe(272);
      expect(result.tieGames).toBe(0);
      expect(result.perWinRate).toBe(1.98);

      const chiefs = result.teams.find(t => t.teamId === 'team-a');
      const raiders = result.teams.find(t => t.teamId === 'team-b');
      const unmatched = result.teams.find(t => t.teamId === 'team-c');

      expect(chiefs.wins).toBe(10);
      expect(chiefs.dividendPrice).toBe(19.8); // 10 * 1.98
      expect(raiders.wins).toBe(5);
      expect(raiders.dividendPrice).toBe(9.9); // 5 * 1.98

      // A team ESPN doesn't recognize gets zero wins/payout.
      expect(unmatched.matched).toBe(false);
      expect(unmatched.wins).toBe(0);
      expect(unmatched.dividendPrice).toBe(0);
      expect(result.unmatchedTeamNames).toEqual(['Team Not On ESPN']);
    });

    it('honors an admin-configured pool percent override instead of the default', async () => {
      setupTournament({
        settings: { milestones: [{ id: '1', name: 'Reg Season Wins', poolPercent: 0.5, slotCount: 272 }] }
      });

      const result = await TournamentService.previewRegularSeasonDividends(TOURNAMENT_ID);

      // 50% of $1000 = $500 across 272 win slots -> floor(1.8382 * 100)/100 = 1.83
      expect(result.perWinRate).toBe(1.83);
    });

    it('honors an admin-configured slot count (e.g. lowered for a tied game)', async () => {
      setupTournament({
        settings: { milestones: [{ id: '1', name: 'Reg Season Wins', poolPercent: 0.54, slotCount: 271 }] }
      });

      const result = await TournamentService.previewRegularSeasonDividends(TOURNAMENT_ID);

      expect(result.slotCount).toBe(271);
      // floor((540 / 271) * 100) / 100 = 1.99
      expect(result.perWinRate).toBe(1.99);
    });

    it('still produces a per-win rate from the season slot count when no games have been played', async () => {
      setupTournament();
      StandingsService.fetchNflStandings.mockResolvedValue(new Map());

      const result = await TournamentService.previewRegularSeasonDividends(TOURNAMENT_ID);

      expect(result.totalLeagueWins).toBe(0);
      expect(result.perWinRate).toBe(1.98); // 54% of $1000 / 272
      result.teams.forEach(t => expect(t.dividendPrice).toBe(0)); // 0 wins each
    });

    it('throws when the tournament does not exist', async () => {
      Tournament.findByPk.mockResolvedValue(null);

      await expect(TournamentService.previewRegularSeasonDividends('missing'))
        .rejects.toThrow('tournament not found for id: missing');
    });
  });

  describe('previewDivisionTitleDividends', () => {
    it('pays the flat division-title bonus only to the best matched team per ESPN division', async () => {
      setupTournament();

      const result = await TournamentService.previewDivisionTitleDividends(TOURNAMENT_ID);

      // Both matched teams share "AFC West"; Chiefs have the better win%.
      // Milestone 2 defaults to 40% of pool across 8 division slots:
      // round2(0.40 * 1000 / 8) = 50 per winning team.
      expect(result.slotCount).toBe(8);
      expect(result.flatBonus).toBe(50);
      const chiefs = result.teams.find(t => t.teamId === 'team-a');
      const raiders = result.teams.find(t => t.teamId === 'team-b');

      expect(chiefs.achieved).toBe(true);
      expect(chiefs.dividendPrice).toBe(50);
      expect(raiders.achieved).toBe(false);
      expect(raiders.dividendPrice).toBe(0);
    });
  });

  describe('previewConfSeed1Dividends', () => {
    it('pays the flat bonus only to the team ESPN marks as the #1 conference seed', async () => {
      setupTournament();

      const result = await TournamentService.previewConfSeed1Dividends(TOURNAMENT_ID);

      // Milestone 3 defaults to 6% of pool across 2 seed slots:
      // round2(0.06 * 1000 / 2) = 30 per #1 seed.
      expect(result.slotCount).toBe(2);
      expect(result.flatBonus).toBe(30);
      const chiefs = result.teams.find(t => t.teamId === 'team-a');
      const raiders = result.teams.find(t => t.teamId === 'team-b');

      expect(chiefs.achieved).toBe(true); // playoffSeed: 1
      expect(chiefs.dividendPrice).toBe(30);
      expect(raiders.achieved).toBe(false); // playoffSeed: 0
      expect(raiders.dividendPrice).toBe(0);
    });
  });

  describe('saveMilestoneResults', () => {
    function mockTeamsForSave(seedMilestoneData = null) {
      const saved = {};
      TournamentTeam.findByPk.mockImplementation(async (id) => ({
        id,
        tournamentId: TOURNAMENT_ID,
        milestoneData: seedMilestoneData ? [...seedMilestoneData] : null,
        changed() {},
        async save() { saved[this.id] = this.milestoneData; }
      }));
      return saved;
    }

    it('derives regular-season dividendPrice from wins x per-slot payout', async () => {
      Tournament.findByPk.mockResolvedValue({ id: TOURNAMENT_ID, settings: null });
      Entry.findAll.mockResolvedValue([{ ipoCashSpent: 600 }, { ipoCashSpent: 400 }]);
      const saved = mockTeamsForSave();

      await TournamentService.saveMilestoneResults(TOURNAMENT_ID, '1', 'Reg Season Wins', [
        { tournamentTeamId: 'tt-a', wins: 10, losses: 4, ties: 0 },
        { tournamentTeamId: 'tt-b', wins: 5, losses: 9, ties: 0 }
      ]);

      // perWin = floor(0.54 * 1000 / 272 * 100) / 100 = 1.98
      expect(saved['tt-a'][0].dividendPrice).toBe(19.8);
      expect(saved['tt-a'][0].wins).toBe(10);
      expect(saved['tt-b'][0].dividendPrice).toBe(9.9);
    });

    it('derives flat-bonus dividendPrice from the achieved flag and per-slot payout', async () => {
      Tournament.findByPk.mockResolvedValue({ id: TOURNAMENT_ID, settings: null });
      Entry.findAll.mockResolvedValue([{ ipoCashSpent: 1000 }]);
      // Milestone 1 already saved, so milestone 2 lands at index 1.
      const seed = [{ milestoneId: '1', milestoneName: 'Reg Season Wins', dividendPrice: 0, wins: 0, losses: 0, ties: 0, achieved: false }];
      const saved = mockTeamsForSave(seed);

      await TournamentService.saveMilestoneResults(TOURNAMENT_ID, '2', 'Division Title', [
        { tournamentTeamId: 'tt-a', achieved: true },
        { tournamentTeamId: 'tt-b', achieved: false }
      ]);

      // round2(0.40 * 1000 / 8) = 50 for the achiever, 0 otherwise
      expect(saved['tt-a'][1].dividendPrice).toBe(50);
      expect(saved['tt-a'][1].achieved).toBe(true);
      expect(saved['tt-b'][1].dividendPrice).toBe(0);
      expect(saved['tt-b'][1].achieved).toBe(false);
    });

    it('refuses to write to a closed tournament', async () => {
      Tournament.findByPk.mockResolvedValue({ id: TOURNAMENT_ID, settings: null, status: 'closed' });
      Entry.findAll.mockResolvedValue([{ ipoCashSpent: 1000 }]);
      mockTeamsForSave();

      await expect(
        TournamentService.saveMilestoneResults(TOURNAMENT_ID, '1', 'Reg Season Wins', [
          { tournamentTeamId: 'tt-a', wins: 1 }
        ])
      ).rejects.toThrow('closed');
    });
  });

  describe('updateMilestoneConfig', () => {
    it('sets poolPercent and slotCount and backfills every milestone with defaults', async () => {
      let savedSettings = null;
      Tournament.findByPk.mockResolvedValue({
        id: TOURNAMENT_ID,
        settings: null,
        changed() {},
        async save() {},
        set settings(v) { savedSettings = v; },
        get settings() { return savedSettings; }
      });

      await TournamentService.updateMilestoneConfig(TOURNAMENT_ID, '1', { poolPercent: 0.6, slotCount: 271 });

      const milestones = savedSettings.milestones;
      expect(milestones).toHaveLength(7);
      const m1 = milestones.find(m => m.id === '1');
      expect(m1.poolPercent).toBe(0.6);
      expect(m1.slotCount).toBe(271);
      const m7 = milestones.find(m => m.id === '7');
      expect(m7.poolPercent).toBe(0.15);
      expect(m7.slotCount).toBe(1);
    });
  });

  describe('regular-season auto-refresh', () => {
    const ALL_MATCHED = new Map([
      ['Kansas City Chiefs', { wins: 10, losses: 4, ties: 0, winPercent: 0.71, playoffSeed: 1, divisionName: 'AFC West' }],
      ['Las Vegas Raiders', { wins: 5, losses: 9, ties: 0, winPercent: 0.36, playoffSeed: 0, divisionName: 'AFC West' }],
      ['Team Not On ESPN', { wins: 3, losses: 11, ties: 0, winPercent: 0.21, playoffSeed: 0, divisionName: 'AFC West' }]
    ]);

    function mockSaveTargets() {
      const saved = {};
      TournamentTeam.findByPk.mockImplementation(async (id) => ({
        id, tournamentId: TOURNAMENT_ID, milestoneData: null,
        changed() {}, async save() { saved[this.id] = this.milestoneData; }
      }));
      return saved;
    }

    it('saves fresh wins when standings differ from what is stored', async () => {
      setupTournament();
      StandingsService.fetchNflStandings.mockResolvedValue(ALL_MATCHED);
      const saved = mockSaveTargets();

      const result = await TournamentService.refreshRegularSeasonMilestoneForTournament({ id: TOURNAMENT_ID });

      expect(result.status).toBe('updated');
      expect(saved['tt-a'][0].wins).toBe(10);
      expect(saved['tt-b'][0].wins).toBe(5);
    });

    it('skips the save when a team cannot be matched to standings', async () => {
      setupTournament(); // team-c has no ESPN entry
      mockSaveTargets();

      const result = await TournamentService.refreshRegularSeasonMilestoneForTournament({ id: TOURNAMENT_ID });

      expect(result.status).toBe('skipped-unmatched');
      expect(result.unmatchedTeamNames).toEqual(['Team Not On ESPN']);
    });

    it('skips the save when stored wins already match', async () => {
      setupTournament();
      StandingsService.fetchNflStandings.mockResolvedValue(ALL_MATCHED);
      TournamentTeam.findAll.mockResolvedValue([
        { id: 'tt-a', teamId: 'team-a', tournamentId: TOURNAMENT_ID, milestoneData: [{ milestoneId: '1', wins: 10 }] },
        { id: 'tt-b', teamId: 'team-b', tournamentId: TOURNAMENT_ID, milestoneData: [{ milestoneId: '1', wins: 5 }] },
        { id: 'tt-c', teamId: 'team-c', tournamentId: TOURNAMENT_ID, milestoneData: [{ milestoneId: '1', wins: 3 }] }
      ]);
      const saved = mockSaveTargets();

      const result = await TournamentService.refreshRegularSeasonMilestoneForTournament({ id: TOURNAMENT_ID });

      expect(result.status).toBe('unchanged');
      expect(Object.keys(saved)).toHaveLength(0);
    });

    it('autoRefresh only touches active, opted-in tournaments', async () => {
      Tournament.findAll.mockResolvedValue([
        { id: 't-active-on', status: 'active', settings: { autoRefreshRegularSeason: true } },
        { id: 't-active-off', status: 'active', settings: { autoRefreshRegularSeason: false } },
        { id: 't-closed-on', status: 'closed', settings: { autoRefreshRegularSeason: true } }
      ]);
      const spy = jest.spyOn(TournamentService, 'refreshRegularSeasonMilestoneForTournament')
        .mockResolvedValue({ status: 'unchanged' });

      const result = await TournamentService.autoRefreshRegularSeasonMilestones();

      expect(result.checked).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].id).toBe('t-active-on');
      spy.mockRestore();
    });
  });
});
