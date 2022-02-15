'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable('Tournament', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      name: Sequelize.STRING,
      leagueId: {
        type: Sequelize.UUID,
        references: { model: 'League', key: 'id' }
      },
      settings: {
        type: Sequelize.JSON
      },
      isIpoOpen: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      masterSheetUpload: {
        type: Sequelize.STRING
      },
      pricingSheetUpload: {
        type: Sequelize.STRING
      },
      rulesSheetUpload: {
        type: Sequelize.STRING
      },
      projectedPayoutSheetUpload: {
        type: Sequelize.STRING
      },
      stockPayoutSheetUpload: {
        type: Sequelize.STRING
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
    return queryInterface.dropTable('Tournament');
  }
};
