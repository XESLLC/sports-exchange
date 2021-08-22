const StockService = require('../../../services/StockService');

const Stock = {
  Query: {
    getOfferedStocksForEntry: async (_, input) => {
      const entryId = input.entryId;
      const stocks = await StockService.getOfferedStocksForEntry(entryId);
      return stocks;
    },
    stocksByEntryId: async (_, input) => {
      const entryId = input.entryId;
      const stocks = await StockService.stocksByEntryId(entryId);
      return stocks;
    }
  },
  Mutation: {
    sellEntryStocks: async (_, { input }) => {
      const { email, entryId, tournamentTeamId, quantity } = input;
      const stocks = await StockService.sellEntryStocks(email, entryId, tournamentTeamId, quantity);
      return stocks;
    },
    setStockAskPrice: async (_, { input }) => {
      const { email, entryId, tournamentTeamId, quantity, newPrice } = input;
      const stocks = await StockService.setStockAskPrice(email, entryId, tournamentTeamId, quantity, newPrice);
      return stocks;
    },
    setTournamentTeamStockPriceToNull: async (_, input) => {
      const tournamentTeamId = input.tournamentTeamId;
      const entryId = input.entryId;
      const entry = await StockService.setTournamentTeamStockPriceToNull(tournamentTeamId, entryId);
      return entry;
    }
  }
};

module.exports = Stock;