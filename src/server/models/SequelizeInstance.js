const { Sequelize } = require('sequelize');
// for local
const database = 'Exchange';
const username = 'exchange';
const password = 'sports';
const host = 'localhost';
const port = '3306';

// for AWS
// const database = 'sports-exchange-db';
// const username = 'admin';
// const password = 'sports-exchange';
// const host = 'sports-exchange-db.cg3onfdtaa7j.us-west-2.rds.amazonaws.com';
// const port = '3306';

const instance = new Sequelize(database, username, password, {
  host,
  port,
  dialect: 'mysql'
});

module.exports = instance;
