const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');

const User = SequelizeInstance.define('User', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: uuidv4()
  },

  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },

  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },

  emailAddr: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  freezeTableName: true
});

module.exports = User;
