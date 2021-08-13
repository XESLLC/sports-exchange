const TournamentTeam = require('../models/TournamentTeam');
const StockEntry = require('../models/StockEntry');
const Team = require('../models/Team');
const Stock = require('../models/Stock');

const StockService = {
  stocksByEntryId: async (entryId) => {
    const stockEntries = await StockEntry.findAll({
      where: {
        entryId
      }
    });

    const stockIds = stockEntries.map(entry => entry.stockId);
    const stocks = await Stock.findAll({
      where: {
        id: stockIds
      }
    });

    const stocksTournamentTeamFrequencyObj = stocks.reduce((result, stock) => {
      if(result && result[stock.tournamentTeamId]) {
        result[stock.tournamentTeamId] += 1;
      } else {
        result[stock.tournamentTeamId] = 1;
      }

      return result;
    }, {});

    const result = Object.keys(stocksTournamentTeamFrequencyObj).map(async (tournamentTeamId) => {
      const tournamentTeam = await TournamentTeam.findByPk(tournamentTeamId)
      const ipoPrice = tournamentTeam.price
      const team = await Team.findByPk(tournamentTeam.teamId)
      const quantity = stocksTournamentTeamFrequencyObj[tournamentTeamId];

      return {
        teamName: team.name,
        ipoPrice,
        quantity
      }
    });
    
    return result;
  }
};

module.exports = StockService;