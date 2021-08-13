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
    userEntries: async (_, input) => {
      const email = input.email;
      const userEntries = await EntryService.userEntries(email);
      return userEntries;
    }
  },

  Mutation: {
    createEntry: async (_, { input }) => {
      const { name, userEmails, tournamentId } = input;
      const entry = await EntryService.createEntry(name, userEmails, tournamentId);
      return entry;
    },
    ipoPurchase: async (_, { input }) => {
      const { tournamentTeamId, quantity, userEmail, entryId } = input;
      const tournamentTeamStock = await EntryService.ipoPurchase(tournamentTeamId, quantity, userEmail, entryId);
      return tournamentTeamStock;
    }
  }
};

module.exports = Entry;