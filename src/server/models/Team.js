const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const League = require('./League');

const Team = SequelizeInstance.define('Team', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },

  // It is possible to create foreign keys:
  leagueId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      // This is a reference to another model
      model: League,

      // This is the column name of the referenced model
      key: 'id'

      // With PostgreSQL, it is optionally possible to declare when to check the foreign key constraint, passing the Deferrable type.
      // deferrable: Deferrable.INITIALLY_IMMEDIATE
      // Options:
      // - `Deferrable.INITIALLY_IMMEDIATE` - Immediately check the foreign key constraints
      // - `Deferrable.INITIALLY_DEFERRED` - Defer all foreign key constraint check to the end of a transaction
      // - `Deferrable.NOT` - Don't defer the checks at all (default) - This won't allow you to dynamically change the rule in a transaction
    }
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  freezeTableName: true,
  indexes: [
    // Team names only need to be unique within a league - see migration
    // 20260730000000-scope-team-name-uniqueness-to-league for why this
    // isn't a plain `unique: true` on the column.
    {
      unique: true,
      fields: ['name', 'leagueId'],
      name: 'team_name_league_id_unique'
    }
  ]
});

module.exports = Team;
