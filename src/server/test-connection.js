const { Sequelize } = require('sequelize');

const database = 'EXCHANGE';
const username = 'root';
const password = 'deavtdc021076';
const host = 'localhost';
const port = '3306';

const sequelize = new Sequelize(database, username, password, {
  host,
  port,
  dialect: 'mysql'
});

const main = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    sequelize.close().then(() => {
      console.log('Connection closed.');
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

main();
