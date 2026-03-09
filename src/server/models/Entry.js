const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const SequelizeInstance = require('./SequelizeInstance');
const Tournament = require('./Tournament');

const Entry = SequelizeInstance.define('Entry', {
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
      model: Tournament,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ipoCashSpent: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  secondaryMarketCashSpent: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  secondaryMarketCashIncome: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
}, {
  freezeTableName: true
});

module.exports = Entry;
