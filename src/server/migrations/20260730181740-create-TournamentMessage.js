'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable('TournamentMessage', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      tournamentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Tournament', key: 'id' }
      },
      entryId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Entry', key: 'id' }
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'User', key: 'id' }
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      notifiedByEmail: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.dropTable('TournamentMessage');
  }
};
