'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable('TournamentTeam', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      price: Sequelize.FLOAT,
      seed: Sequelize.INTEGER,
      teamId: {
        type: Sequelize.UUID,
        references: { model: 'Team', key: 'id' }
      },
      tournamentId: {
        type: Sequelize.UUID,
        references: { model: 'Tournament', key: 'id' }
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
    return queryInterface.dropTable('TournamentTeam');
  }
};
