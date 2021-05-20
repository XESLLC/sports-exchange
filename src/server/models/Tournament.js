const { DataTypes } = require('sequelize');

const SequelizeInstance = require('./SequelizeInstance');
const League = require('./League');

const Tournament = SequelizeInstance.define('Tournament', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },

  leagueId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      // This is a reference to another model
      model: League,

      // This is the column name of the referenced model
      key: 'id'
    }
  },

}, {
  freezeTableName: true
});

module.exports = Tournament;
