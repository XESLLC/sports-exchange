const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const Stock = require('./Stock');
const User = require('./User');

const Transaction = SequelizeInstance.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: uuidv4()
  },

  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
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
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  freezeTableName: true
});

module.exports = Transaction;
