const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const SequelizeInstance = require('./SequelizeInstance');
const User = require('./User');
const Entry = require('./Entry');

const UserEntry = SequelizeInstance.define('UserEntry', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      model: User,
      key: 'id'
    }
  },
  entryId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      model: Entry,
      key: 'id'
    }
  }
}, {
  freezeTableName: true
});

module.exports = UserEntry;