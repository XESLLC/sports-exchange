const { DataTypes } = require('sequelize');
const SequelizeInstance = require('./SequelizeInstance');

const EmailBlast = SequelizeInstance.define('EmailBlast', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tournamentId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false
  },
  htmlBody: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  senderId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  senderName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  recipientCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  failedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Names of entries/participants whose email couldn't be resolved, plus
  // any addresses that failed to send - surfaced back to the admin so
  // nothing silently disappears.
  unresolvedParticipants: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  // [{ filename, key }] - real file attachments (not inline images, which
  // live directly in htmlBody as <img> tags pointing at public S3 URLs).
  attachments: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  status: {
    // 'sent' | 'partial' | 'failed'
    type: DataTypes.STRING,
    defaultValue: 'sent'
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'EmailBlasts',
  freezeTableName: true
});

module.exports = EmailBlast;
