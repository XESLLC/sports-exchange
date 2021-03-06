const StockService = require('../../../services/StockService');

const Stock = {
  Query: {
    getOfferedStocksForTournament: async (_, input) => {
      const tournamentId = input.tournamentId;
      const entryId = input.entryId;
      const offeredStocks = await StockService.getOfferedStocksForTournament(tournamentId, entryId);
      return offeredStocks;
    },
    stocksByEntryId: async (_, input) => {
      const entryId = input.entryId;
      const stocks = await StockService.stocksByEntryId(entryId);
      return stocks;
    },
    getOriginallyPurchasedStocks: async (_, input) => {
      const entryId = input.entryId;
      const stocks = await StockService.getOriginallyPurchasedStocks(entryId);
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
      const { email, entryId, tournamentTeamId, quantity, newPrice, offerExpiresAt, tradableTeams } = input;
      const stocks = await StockService.setStockAskPrice(email, entryId, tournamentTeamId, quantity, newPrice, offerExpiresAt, tradableTeams);
      return stocks;
    },
    tradeStocks: async (_, { input }) => {
      const { email, entryId, stockIdToTradeFor, quantity, tradableTeams, teamName } = input;
      const stocks = await StockService.tradeStocks(email, entryId, stockIdToTradeFor, quantity, tradableTeams, teamName);
      return stocks;
    },
    setTournamentTeamStockPriceToNull: async (_, input) => {
      const tournamentTeamId = input.tournamentTeamId;
      const entryId = input.entryId;
      const entry = await StockService.setTournamentTeamStockPriceToNull(tournamentTeamId, entryId);
      return entry;
    },
    removeExpiredBidsAndAsks: async (_, input) => {
      const tournamentId = input.tournamentId;
      const resultString = await StockService.removeExpiredBidsAndAsks(tournamentId);
      return resultString;
    },
    deleteStocks: async (_, { entryId, stockIds } ) => {
      const entry = await StockService.deleteStocks(entryId, stockIds);
      return entry;
    },
    manualTrade: async (_, { entryId, stockIds, receivingEntryId, pricePerStock } ) => {
      const entry = await StockService.manualTrade(entryId, stockIds, receivingEntryId, pricePerStock);
      return entry;
    }
  }
};

module.exports = Stock;
