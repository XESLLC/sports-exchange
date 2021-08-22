const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const SequelizeInstance = require('./SequelizeInstance');
const Entry = require('./Entry');
const TournamentTeam = require('./TournamentTeam');

const EntryBid = SequelizeInstance.define('EntryBid', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },
  entryId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      model: Entry,
      key: 'id'
    }
  },
  tournamentTeamId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      model: TournamentTeam,
      key: 'id'
    }
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true
});

module.exports = EntryBid;