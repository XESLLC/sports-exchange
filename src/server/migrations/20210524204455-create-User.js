'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable('User', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      cash: {
        type: Sequelize.FLOAT,
        defaultValue: 0,
        allowNull: false
      },
      // tournamentId: Sequelize.STRING,
      email: Sequelize.STRING, // same as auth email
      firstname: Sequelize.STRING,
      lastname: Sequelize.STRING,
      username: Sequelize.STRING,
      phoneNumber: Sequelize.STRING,
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
    return queryInterface.dropTable('User');
  }
};
