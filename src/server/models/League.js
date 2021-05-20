const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

const SequelizeInstance = require('./SequelizeInstance');

const League = SequelizeInstance.define('League', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: uuidv4()
  },

  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  freezeTableName: true
});

module.exports = League;
