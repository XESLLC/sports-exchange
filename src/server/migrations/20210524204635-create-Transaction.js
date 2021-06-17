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
      cost: Sequelize.INTEGER,
      stockId: {
        type: Sequelize.UUID,
        references: { model: 'Stock', key: 'id' }
      },
      userId: {
        type: Sequelize.UUID,
        references: { model: 'User', key: 'id' }
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
