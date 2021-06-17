'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable('Stock', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      price: {
          type: Sequelize.INTEGER,
          allowNull: true // negative numbers represent a bid price // can only be set to 0 by admin when out of tourn. // set to null when not being traded.
      },
      tournamentTeamId: {
        type: Sequelize.UUID,
        references: { model: 'TournamentTeam', key: 'id' }
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
    return queryInterface.dropTable('Stock');
  }
};
