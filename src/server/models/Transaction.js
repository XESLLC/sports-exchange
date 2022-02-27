const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const Stock = require('./Stock');
const Entry = require('./Entry');

const Transaction = SequelizeInstance.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },
  entryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Entry,
      key: 'id'
    }
  },
  stockId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Stock,
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  cost: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  groupId: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  freezeTableName: true
});

module.exports = Transaction;
