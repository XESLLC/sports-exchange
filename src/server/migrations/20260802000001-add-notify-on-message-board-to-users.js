'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('User', 'notifyOnMessageBoard', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('User', 'notifyOnMessageBoard');
  }
};
