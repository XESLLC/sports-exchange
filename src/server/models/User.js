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
  // users belong to only one tournament?
  // tournamentId: {
  //     type: DataTypes.STRING,
  //     allowNull: true
  // },
  // cash for a single user doesnt make sense
  // don't we need cash for each tournament? unless each user only has one source of cash for all tournaments, if that's the case, how do we handle tournament entries with multiple owners?
  cash: {
      type: DataTypes.FLOAT,
      allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  freezeTableName: true
});

module.exports = User;
