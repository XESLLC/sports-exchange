'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable('Transaction', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      quantity: Sequelize.INTEGER,
      cost: Sequelize.FLOAT,
      stockId: {
        type: Sequelize.UUID,
        references: { model: 'Stock', key: 'id' }
      },
      entryId: {
        type: Sequelize.UUID,
        references: { model: 'Entry', key: 'id' }
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
    return queryInterface.dropTable('Transaction');
  }
};
