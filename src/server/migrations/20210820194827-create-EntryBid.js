'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable('EntryBid', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      entryId: {
        type: Sequelize.UUID,
        references: { model: 'Entry', key: 'id' }
      },
      tournamentTeamId: {
        type: Sequelize.UUID,
        references: { model: 'TournamentTeam', key: 'id' }
      },
      price: Sequelize.FLOAT,
      quantity: Sequelize.INTEGER,
      expiresAt: {
        type: Sequelize.DATE
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
    return queryInterface.dropTable('EntryBid');
  }
};
