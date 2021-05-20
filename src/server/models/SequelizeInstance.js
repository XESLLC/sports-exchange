const { Sequelize } = require('sequelize');

const database = 'EXCHANGE';
const username = 'exchange';
const password = 'sports';
const host = 'localhost';
const port = '3306';

const instance = new Sequelize(database, username, password, {
  host,
  port,
  dialect: 'mysql'
});

module.exports = instance;
