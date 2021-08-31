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
    type: DataTypes.FLOAT,
    allowNull: true
  },// bids are now being handled by the EntryBid table. Price set to a positive value represents the price the team is willing to accept in trade. Price set to null represents Stock not available for trade
  originalIpoEntryId: {
    type: DataTypes.UUID
  },
  offerExpiresAt: {
    type: DataTypes.DATE
  }
}, {
  freezeTableName: true
});

//get stocks on tourn id check for price not null and offers expires at then change all them to price null and offer expires at null. Check for bids, In entry bids table



module.exports = Stock;
