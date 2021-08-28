const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const League = require('./League');

const Tournament = SequelizeInstance.define('Tournament', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
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
  settings: {
    type: DataTypes.JSON
  },
  isIpoOpen: {
    type: DataTypes.BOOLEAN
  }
}, {
  freezeTableName: true
});

module.exports = Tournament;
