'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('User', 'isAdmin', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    // Seed the real admins
    await queryInterface.sequelize.query(
      `UPDATE User SET isAdmin = true WHERE email IN ('couvillion@gmail.com', 'david.xesllc@gmail.com', 'bartsched@gmail.com')`
    );
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('User', 'isAdmin');
  }
};
