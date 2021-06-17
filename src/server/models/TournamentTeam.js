const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const SequelizeInstance = require('./SequelizeInstance');
const Team = require('./Team');
const Tournament = require('./Tournament');

const TournamentTeam = SequelizeInstance.define('TournamentTeam', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },

  tournamentId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      // This is a reference to another model
      model: Tournament,

      // This is the column name of the referenced model
      key: 'id'
    }
  },

  teamId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      model: Team,
      key: 'id'
    }
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  }, //IPO price only
  seed: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true
});

module.exports = TournamentTeam;
