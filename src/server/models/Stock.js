const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const SequelizeInstance = require('./SequelizeInstance');
const Team = require('./Team');
const TournamentTeam = require('./TournamentTeam');
const Tournament = require('./Tournament');

const Stock = SequelizeInstance.define('Stock', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  tournamentTeamId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: 'compositeIndex',
    references: {
      model: TournamentTeam,
      key: 'id'
    }
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  }// negative numbers represent a bid price // can only be set to 0 by admin when out of tourn. // set to null when not being traded. bid is deleted after stock purchase. ask user Id changed after purchase and price set to null.
}, {
  freezeTableName: true
});



module.exports = Stock;
