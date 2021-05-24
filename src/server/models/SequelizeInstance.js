const { Sequelize } = require('sequelize');

isNotLocal = (process.env.ENV !== 'local')
// isNotLocal? aws db : local db
const database = isNotLocal? 'sports_exchange_db' : 'Exchange';
const username = isNotLocal? 'admin' : 'exchange';
const password = isNotLocal? 'sports-exchange' : 'sports';
const host = isNotLocal? 'sports-exchange-db.cg3onfdtaa7j.us-west-2.rds.amazonaws.com' : 'localhost';
const port = '3306';

const instance = new Sequelize(database, username, password, {
  host: host,
  port: port,
  dialect: 'mysql'
});

module.exports = instance;
