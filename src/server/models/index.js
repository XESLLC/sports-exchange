const League = require('./League');
const Stock = require('./Stock');
const StockUser = require('./StockUser');
const Team = require('./Team');
const Tournament = require('./Tournament');
const Transaction = require('./Transaction');
const TournamentTeam = require('./TournamentTeam');
const User = require('./User');

const SequelizeInstance = require('./SequelizeInstance');

const initModels = async () => {
  // Connect
  await SequelizeInstance.authenticate();
  console.log('Connection has been established successfully.');

  // NOTE: Do NOT change the order of these calls. They are called in this
  // order due to foreign key constraints.
  await League.sync();
  await Team.sync();
  await Tournament.sync();
  await TournamentTeam.sync();
  await User.sync();
  await Stock.sync();
  await StockUser.sync();
  await Transaction.sync();

};

exports.initModels = initModels;
