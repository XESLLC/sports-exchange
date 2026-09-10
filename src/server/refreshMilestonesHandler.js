const TournamentService = require('./services/TournamentService');

// EventBridge scheduled entry point (see serverless.yml). Refreshes the
// Regular Season Wins milestone from live ESPN standings for every
// tournament that opted in (settings.autoRefreshRegularSeason).
//
// The schedule fires every 15 minutes Thu-Tue; this handler no-ops
// outside the "Thursday afternoon through Tuesday morning" window so we
// don't hammer ESPN on quiet days. Times are UTC - the fixed hours below
// approximate ~noon and ~10am US Eastern across both EDT and EST.
module.exports.handler = async () => {
  const now = new Date();
  const day = now.getUTCDay();   // 0 Sun .. 6 Sat
  const hour = now.getUTCHours();

  const TUE = 2, WED = 3, THU = 4;
  let inWindow = true;
  if (day === WED) {
    inWindow = false;                       // whole day off
  } else if (day === THU && hour < 16) {
    inWindow = false;                       // before ~noon ET Thursday
  } else if (day === TUE && hour >= 15) {
    inWindow = false;                       // after ~10am ET Tuesday
  }
  // Fri / Sat / Sun / Mon: always on.

  if (!inWindow) {
    console.log(`refreshMilestones: ${now.toISOString()} outside window (day ${day}, hour ${hour}) - skipped`);
    return { statusCode: 200, body: 'outside refresh window' };
  }

  const result = await TournamentService.autoRefreshRegularSeasonMilestones();
  console.log(`refreshMilestones: ${now.toISOString()} ${JSON.stringify(result)}`);
  return { statusCode: 200, body: JSON.stringify(result) };
};
