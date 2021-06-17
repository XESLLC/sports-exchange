const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');

const User = SequelizeInstance.define('User', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },
  firstname: {
    type: DataTypes.STRING,
    allowNull: false
  },

  lastname: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tournamentId: {
      type: DataTypes.STRING,
      allowNull: false
  },
  cash: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  freezeTableName: true
});

module.exports = User;
