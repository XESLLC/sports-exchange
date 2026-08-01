const https = require('https');

// ESPN's public standings endpoint. No API key required.
// Docs (unofficial): https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?level=3
const ESPN_STANDINGS_URL = 'https://site.web.api.espn.com/apis/v2/sports/football/nfl/standings?level=3';

// Maps ESPN's full displayName -> DB Team.name, for cases where they diverge.
// DB Team.name stores full city+mascot names (e.g. "Las Vegas Raiders") which
// match ESPN's displayName for all current teams except Washington, which the
// DB still has as "Washington Football Team" from before the 2022 rebrand.
const TEAM_NAME_ALIASES = {
  'Washington Commanders': 'Washington Football Team',
  'Washington Redskins':   'Washington Football Team', // historical, just in case
};

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'sports-exchange-app' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`ESPN standings request failed with status ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse ESPN standings response: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Recursively walks ESPN's league -> conference -> division -> entries tree.
// Division-level nodes are the ones with a `standings.entries` array; the
// conference name is inherited from whichever ancestor node's `name` was
// last seen on the way down (root's own name gets naturally overwritten by
// the AFC/NFC level before reaching the divisions, so no special-casing
// is needed for the root).
function flattenStandingsEntries(node, results, context = {}) {
  if (node && node.standings && Array.isArray(node.standings.entries)) {
    const divisionName = node.name;
    for (const entry of node.standings.entries) {
      const teamName = entry.team && entry.team.name; // mascot-only, e.g. "Chiefs"
      const statsByName = {};
      for (const stat of entry.stats || []) {
        statsByName[stat.name] = stat.value;
      }
      results.push({
        espnTeamName: teamName,
        espnDisplayName: entry.team && entry.team.displayName,
        wins: Math.round(statsByName.wins || 0),
        losses: Math.round(statsByName.losses || 0),
        ties: Math.round(statsByName.ties || 0),
        winPercent: statsByName.winPercent || 0,
        // ESPN's playoff seed: 1 = top seed in that conference, 0 = not yet seeded (e.g. preseason)
        playoffSeed: Math.round(statsByName.playoffSeed || 0),
        conferenceName: context.conferenceName || null,
        divisionName
      });
    }
    return;
  }
  if (node && Array.isArray(node.children)) {
    const nextContext = { ...context, conferenceName: node.name || context.conferenceName };
    for (const child of node.children) {
      flattenStandingsEntries(child, results, nextContext);
    }
  }
}

const StandingsService = {
  // Returns a Map keyed by normalized team name -> standings info, including
  // wins/losses/ties, winPercent, playoffSeed, conferenceName, divisionName.
  fetchNflStandings: async () => {
    const json = await httpsGetJson(ESPN_STANDINGS_URL);
    const flat = [];
    flattenStandingsEntries(json, flat);

    if (flat.length === 0) {
      throw new Error('ESPN standings response did not contain any team entries - the endpoint may have changed');
    }

    const standingsByTeamName = new Map();
    for (const entry of flat) {
      // Use displayName ("Kansas City Chiefs") not name ("Chiefs") because
      // DB Team.name stores full city+mascot names. Alias catches Washington.
      const lookupName = entry.espnDisplayName || entry.espnTeamName;
      const normalizedName = TEAM_NAME_ALIASES[lookupName] || lookupName;
      standingsByTeamName.set(normalizedName, {
        wins: entry.wins,
        losses: entry.losses,
        ties: entry.ties,
        winPercent: entry.winPercent,
        playoffSeed: entry.playoffSeed,
        conferenceName: entry.conferenceName,
        divisionName: entry.divisionName,
        espnDisplayName: entry.espnDisplayName
      });
    }

    return standingsByTeamName;
  }
};

module.exports = StandingsService;
