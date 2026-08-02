'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('TournamentMessage', 'title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('TournamentMessage', 'parentId', {
      type: Sequelize.UUID,
      allowNull: true
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('TournamentMessage', 'parentId');
    await queryInterface.removeColumn('TournamentMessage', 'title');
  }
};
