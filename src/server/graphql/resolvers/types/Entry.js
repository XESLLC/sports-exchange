const EntryService = require('../../../services/EntryService');

const Entry = {
  Query: {
    entry: async (_, input) => {
      const id = input.id;
      const entry = await EntryService.entry(id);
      return entry;
    },
    entriesByTournamentId: async (_, input) => {
      const tournamentId = input.tournamentId;
      const entries = await EntryService.entriesByTournamentId(tournamentId);
      return entries;
    },
    getBidsForEntry: async (_, input) => {
      const entryId = input.entryId;
      const entryBids = await EntryService.getBidsForEntry(entryId);
      return entryBids;
    },
    userEntries: async (_, input) => {
      const email = input.email;
      const userEntries = await EntryService.userEntries(email);
      return userEntries;
    },
    portfolioSummaries: async (_, input) => {
      const tournamentId = input.tournamentId;
      const entryId = input.entryId;
      const portfolioSummaries = await EntryService.portfolioSummaries(tournamentId, entryId);
      return portfolioSummaries;
    }
  },

  Mutation: {
    createEntry: async (_, { input }) => {
      const { name, userEmails, tournamentId } = input;
      const entry = await EntryService.createEntry(name, userEmails, tournamentId);
      return entry;
    },
    createEntryBid: async (_, { input }) => {
      const { entryId, tournamentTeamId, price, quantity, expiresAt } = input;
      const entryBid = await EntryService.createEntryBid(entryId, tournamentTeamId, price, quantity, expiresAt);
      return entryBid;
    },
    deleteEntryBid: async (_, input) => {
      const id = input.id;
      const entry = await EntryService.deleteEntryBid(id);
      return entry;
    },
    ipoPurchase: async (_, { input }) => {
      const { tournamentTeamId, quantity, userEmail, entryId } = input;
      const tournamentTeamStock = await EntryService.ipoPurchase(tournamentTeamId, quantity, userEmail, entryId);
      return tournamentTeamStock;
    },
    updateEntryCashSpent: async (_, { entryId, ipoCashSpent, secondaryMarketCashSpent } ) => {
      const entry = await EntryService.updateEntryCashSpent(entryId, ipoCashSpent, secondaryMarketCashSpent);
      return entry;
    }
  }
};

module.exports = Entry;
