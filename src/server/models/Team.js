const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const League = require('./League');

const Team = SequelizeInstance.define('Team', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: uuidv4()
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
    allowNull: false,
    unique: true
  }
}, {
  freezeTableName: true
});

module.exports = Team;
