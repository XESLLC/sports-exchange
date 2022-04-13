'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Entry', 'secondaryMarketCashIncome', {
      type: Sequelize.FLOAT,
      allowNull: true,
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Entry', 'secondaryMarketCashIncome');
  }
};
