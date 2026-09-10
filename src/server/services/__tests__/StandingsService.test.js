const https = require('https');
const { EventEmitter } = require('events');

jest.mock('https');

const StandingsService = require('../StandingsService');

// Builds a fake ESPN response shaped like the real
// league -> conference -> division -> standings.entries tree.
function buildEspnResponse(overrides = {}) {
  return {
    name: 'NFL',
    children: [
      {
        name: 'AFC',
        children: [
          {
            name: 'AFC West',
            standings: {
              entries: [
                {
                  team: { name: 'Chiefs', displayName: 'Kansas City Chiefs' },
                  stats: [
                    { name: 'wins', value: 11 },
                    { name: 'losses', value: 3 },
                    { name: 'ties', value: 0 },
                    { name: 'winPercent', value: 0.786 },
                    { name: 'playoffSeed', value: 1 }
                  ]
                },
                {
                  team: { name: 'Raiders', displayName: 'Las Vegas Raiders' },
                  stats: [
                    { name: 'wins', value: 5 },
                    { name: 'losses', value: 9 },
                    { name: 'ties', value: 0 },
                    { name: 'winPercent', value: 0.357 },
                    { name: 'playoffSeed', value: 0 }
                  ]
                }
              ]
            }
          }
        ]
      },
      {
        name: 'NFC',
        children: [
          {
            name: 'NFC East',
            standings: {
              entries: [
                {
                  team: { name: 'Commanders', displayName: 'Washington Commanders' },
                  stats: [
                    { name: 'wins', value: 8 },
                    { name: 'losses', value: 6 },
                    { name: 'ties', value: 1 },
                    { name: 'winPercent', value: 0.567 },
                    { name: 'playoffSeed', value: 4 }
                  ]
                }
              ]
            }
          }
        ]
      }
    ],
    ...overrides
  };
}

// Wires https.get(url, opts, cb) to respond with the given status/body,
// mirroring the res.on('data'/'end') pattern StandingsService relies on.
function mockHttpsResponse({ statusCode = 200, body }) {
  https.get.mockImplementation((url, options, callback) => {
    const res = new EventEmitter();
    res.statusCode = statusCode;
    callback(res);
    process.nextTick(() => {
      res.emit('data', Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
      res.emit('end');
    });
    return new EventEmitter(); // stand-in for the ClientRequest, supports .on('error')
  });
}

describe('StandingsService.fetchNflStandings', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('hits the ESPN standings endpoint', async () => {
    mockHttpsResponse({ body: buildEspnResponse() });

    await StandingsService.fetchNflStandings();

    expect(https.get).toHaveBeenCalledTimes(1);
    const [url] = https.get.mock.calls[0];
    expect(url).toBe('https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?level=3');
  });

  it('parses wins/losses/ties and playoff seed per team, keyed by full team name', async () => {
    mockHttpsResponse({ body: buildEspnResponse() });

    const standings = await StandingsService.fetchNflStandings();
    const chiefs = standings.get('Kansas City Chiefs');

    expect(chiefs).toEqual({
      wins: 11,
      losses: 3,
      ties: 0,
      winPercent: 0.786,
      playoffSeed: 1,
      conferenceName: 'AFC',
      divisionName: 'AFC West',
      espnDisplayName: 'Kansas City Chiefs'
    });
  });

  it('remaps Washington Commanders to the DB\'s legacy team name', async () => {
    mockHttpsResponse({ body: buildEspnResponse() });

    const standings = await StandingsService.fetchNflStandings();

    expect(standings.has('Washington Football Team')).toBe(true);
    expect(standings.has('Washington Commanders')).toBe(false);
    expect(standings.get('Washington Football Team').wins).toBe(8);
    expect(standings.get('Washington Football Team').ties).toBe(1);
  });

  it('rejects when ESPN responds with a non-2xx status', async () => {
    mockHttpsResponse({ statusCode: 503, body: {} });

    await expect(StandingsService.fetchNflStandings())
      .rejects.toThrow('ESPN standings request failed with status 503');
  });

  it('rejects when the response body is not valid JSON', async () => {
    mockHttpsResponse({ statusCode: 200, body: 'not json{' });

    await expect(StandingsService.fetchNflStandings())
      .rejects.toThrow(/Failed to parse ESPN standings response/);
  });

  it('rejects when the response has no team entries (endpoint shape changed)', async () => {
    mockHttpsResponse({ body: { name: 'NFL', children: [] } });

    await expect(StandingsService.fetchNflStandings())
      .rejects.toThrow('ESPN standings response did not contain any team entries - the endpoint may have changed');
  });

  it('rejects when the underlying request errors out', async () => {
    const requestEmitter = new EventEmitter();
    https.get.mockImplementation((url, options, callback) => {
      process.nextTick(() => requestEmitter.emit('error', new Error('socket hang up')));
      return requestEmitter;
    });

    await expect(StandingsService.fetchNflStandings()).rejects.toThrow('socket hang up');
  });
});
