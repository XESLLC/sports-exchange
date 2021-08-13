const StockService = require('../../../services/StockService');

const Stock = {
  Query: {
    stocksByEntryId: async (_, input) => {
      const entryId = input.entryId;
      const stocks = await StockService.stocksByEntryId(entryId);
      return stocks;
    }
  }
};

module.exports = Stock;