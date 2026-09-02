'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('EntryBid', 'tradableTeams', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('EntryBid', 'tradableTeams');
  }
};
