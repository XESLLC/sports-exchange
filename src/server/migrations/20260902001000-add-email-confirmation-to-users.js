'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('User', 'emailConfirmationToken', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('User', 'emailConfirmedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('User', 'emailConfirmationToken');
    await queryInterface.removeColumn('User', 'emailConfirmedAt');
  }
};
