const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const Team = require('./Team');
const Tournament = require('./Tournament');

const Stock = SequelizeInstance.define('Stock', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: uuidv4()
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

  tournamentId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      model: Tournament,
      key: 'id'
    }
  },

  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  freezeTableName: true
});

module.exports = Stock;
