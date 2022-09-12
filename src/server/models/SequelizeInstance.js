const { Sequelize } = require('sequelize');

(process.env.ENV !== 'local')
isNotLocal? aws db : local db
const database = isNotLocal? 'sports_exchange_db' : 'Exchange';
const username = isNotLocal? 'admin' : 'root';
const password = isNotLocal? 'sports-exchange' : 'test';
const host = isNotLocal? 'sports-exchange-db.cg3onfdtaa7j.us-west-2.rds.amazonaws.com' : 'localhost';
const port = '3306';

const instance = new Sequelize(database, username, password, {
  host: host,
  port: port,
  dialect: 'mysql',
  pool: {
    max: 1,
    min: 0,
    acquire: 10000,
    idle: 5000
  }
});

module.exports = instance;
