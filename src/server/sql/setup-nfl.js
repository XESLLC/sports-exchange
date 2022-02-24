const League = require('../models/League');
const Team = require('../models/Team');
const SequelizeInstance = require('../models/SequelizeInstance');

const { v4: uuidv4 } = require('uuid');

(async () => {
  try {
    // Connect
    await SequelizeInstance.authenticate();
    console.log('Connection has been established successfully.');

    // Setup the tables, if not already done.
    User.sync();
    UserEntry.sync();
    League.sync();
    Team.sync();
    Tournament.sync();
    TournamentTeam.sync();
    Entry.sync();
    EntryBid.sync();
    Stock.sync();
    StockEntry.sync();
    Transactions.sync();

    let league = await League.findOne({
      name: 'NFL'
    });

    if (league === null) {
      await League.create({
        id: uuidv4(),
        name: "NFL"
      });
    }

    ['Patriots', 'Bears'].reduce(async (prev, team) => {
      await prev;

      await Team.create({
        id: uuidv4(),
        leagueId: league.id,
        name: team
      });

      console.log("created team: ", team);
    }, Promise.resolve());

    sequelize.close().then(() => {
      console.log('Connection closed.');
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
})();
