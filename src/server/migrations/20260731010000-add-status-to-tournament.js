'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tournament', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'closed'),
      allowNull: true
    });

    // Backfill from the old boolean before it's removed.
    await queryInterface.sequelize.query(
      `UPDATE Tournament SET status = CASE WHEN isActive = true THEN 'active' ELSE 'inactive' END`
    );

    await queryInterface.changeColumn('Tournament', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'closed'),
      allowNull: false,
      defaultValue: 'active'
    });

    await queryInterface.removeColumn('Tournament', 'isActive');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tournament', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: true
    });

    await queryInterface.sequelize.query(
      `UPDATE Tournament SET isActive = (status = 'active')`
    );

    await queryInterface.changeColumn('Tournament', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.removeColumn('Tournament', 'status');
  }
};
