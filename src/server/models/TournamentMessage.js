const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const SequelizeInstance = require('./SequelizeInstance');
const Tournament = require('./Tournament');
const Entry = require('./Entry');
const User = require('./User');

const TournamentMessage = SequelizeInstance.define('TournamentMessage', {
  id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    defaultValue:  DataTypes.UUIDV4
  },
  tournamentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Tournament,
      key: 'id'
    }
  },
  // The entry the poster belonged to at the time of posting, so the board
  // can show which team/entry a message came from. Nullable in case an
  // entry is later deleted - the post itself should still stand.
  entryId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: Entry,
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
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  notifiedByEmail: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  freezeTableName: true
});

module.exports = TournamentMessage;
