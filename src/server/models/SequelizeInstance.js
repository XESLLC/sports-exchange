const { Sequelize } = require('sequelize');

// useRDS is true when running locally with ENV=local, or when deployed to Lambda (USE_RDS=true)
const useRDS = process.env.ENV === 'local' || process.env.USE_RDS === 'true';
const database = useRDS ? 'sports_exchange_db' : 'Exchange';
const username = useRDS ? 'admin' : 'root';
const password = useRDS ? 'sports-exchange' : 'deavtdc021076';
const host = useRDS ? 'sports-exchange-db.cg3onfdtaa7j.us-west-2.rds.amazonaws.com' : '127.0.0.1';
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
