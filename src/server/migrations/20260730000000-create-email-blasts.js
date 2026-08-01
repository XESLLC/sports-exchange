'use strict';

// ADJUST: rename/move this into wherever your existing migrations live -
// this is a guess at the convention (`migrations/` at repo root). If you
// don't use sequelize-cli migrations and instead rely on `sync()` or manual
// SQL, just use this file as a spec for the table shape and skip running it.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('EmailBlasts', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      tournamentId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING,
        allowNull: false
      },
      htmlBody: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      senderId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      senderName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      recipientCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      failedCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      unresolvedParticipants: {
        type: Sequelize.JSON,
        defaultValue: []
      },
      attachments: {
        type: Sequelize.JSON,
        defaultValue: []
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'sent'
      },
      errorMessage: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('EmailBlasts');
  }
};
