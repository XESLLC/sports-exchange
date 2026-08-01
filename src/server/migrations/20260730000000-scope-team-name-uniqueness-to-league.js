'use strict';

// The original Team model marked `name` unique all by itself, but
// TeamService.createTeam has always called
// `Team.findOrCreate({ where: { name, leagueId } })` - i.e. it was written
// assuming uniqueness is scoped to (name, leagueId), not to name alone.
// That mismatch was mostly invisible with a single NFL league, but it
// becomes a real problem once a second league (e.g. NCAA Basketball) is
// reusing this same Team table: adding "Miami" to that league would throw
// a DB unique-constraint error the moment any other league already has a
// team named "Miami", even though the (name, leagueId) pair is unique.
//
// This migration swaps the single-column unique index for a composite one
// on (name, leagueId), matching what the application code already assumes.
// It also deduplicates any existing (name, leagueId) pairs that were
// created before this constraint existed, keeping the oldest record and
// re-pointing any TournamentTeam rows at it.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Deduplicate existing (name, leagueId) pairs before adding the index.
    const [dupes] = await queryInterface.sequelize.query(`
      SELECT name, leagueId, COUNT(*) AS cnt
      FROM \`Team\`
      GROUP BY name, leagueId
      HAVING cnt > 1
    `);

    for (const dupe of dupes) {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT id FROM `Team` WHERE name = ? AND leagueId = ? ORDER BY createdAt ASC',
        { replacements: [dupe.name, dupe.leagueId] }
      );
      const [keep, ...remove] = rows;
      for (const row of remove) {
        // Re-point TournamentTeam rows so we don't lose tournament history.
        await queryInterface.sequelize.query(
          'UPDATE TournamentTeam SET teamId = ? WHERE teamId = ?',
          { replacements: [keep.id, row.id] }
        );
        await queryInterface.sequelize.query(
          'DELETE FROM `Team` WHERE id = ?',
          { replacements: [row.id] }
        );
      }
    }

    // 2. Remove any pre-existing single-column name unique index.
    const existingIndexes = await queryInterface.showIndex('Team');
    const singleNameUniqueIndex = existingIndexes.find((index) => {
      return index.unique
        && index.fields.length === 1
        && index.fields[0].attribute === 'name';
    });

    if (singleNameUniqueIndex) {
      await queryInterface.removeIndex('Team', singleNameUniqueIndex.name);
    }

    // 3. Skip if composite index already exists (idempotent re-run safety).
    const afterIndexes = await queryInterface.showIndex('Team');
    const alreadyExists = afterIndexes.find(i => i.name === 'team_name_league_id_unique');
    if (!alreadyExists) {
      await queryInterface.addIndex('Team', {
        fields: ['name', 'leagueId'],
        unique: true,
        name: 'team_name_league_id_unique'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Team', 'team_name_league_id_unique');

    await queryInterface.addIndex('Team', {
      fields: ['name'],
      unique: true,
      name: 'name'
    });
  }
};
