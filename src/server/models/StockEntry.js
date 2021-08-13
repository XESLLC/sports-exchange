const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');
const Stock = require('./Stock');
const Entry = require('./Entry');

const StockEntry = SequelizeInstance.define('StockEntry', {
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
  entryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Entry,
      key: 'id'
    }
  }
}, {
  freezeTableName: true
});

module.exports = StockEntry;
