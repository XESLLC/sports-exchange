const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const Stock = require('./Stock');
const User = require('./User');

const StockUser = SequelizeInstance.define('StockUser', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },
  stockId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Stock,
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  freezeTableName: true
});

module.exports = StockUser;
