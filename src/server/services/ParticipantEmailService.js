// Resolves tournament participants -> email addresses using the local DB.
// Emails live on User records, linked to entries via the UserEntry join table.
const Entry = require('../models/Entry');
const UserEntry = require('../models/UserEntry');
const User = require('../models/User');

const ParticipantEmailService = {
  // Returns { resolved: [{ email, displayName }], unresolvedEntryLabels: string[] }
  getParticipantEmails: async (tournamentId) => {
    const entries = await Entry.findAll({ where: { tournamentId } });
    if (!entries || entries.length === 0) {
      return { resolved: [], unresolvedEntryLabels: [] };
    }

    const entryIds = entries.map(e => e.id);
    const userEntries = await UserEntry.findAll({ where: { entryId: entryIds } });
    const userIds = [...new Set(userEntries.map(ue => ue.userId))];
    const users = userIds.length > 0 ? await User.findAll({ where: { id: userIds } }) : [];

    // De-dupe by email - if the same person owns multiple entries in this
    // tournament, they should get one email, not several.
    const seen = new Set();
    const resolved = [];
    for (const user of users) {
      if (user.email && !seen.has(user.email)) {
        seen.add(user.email);
        resolved.push({
          email: user.email,
          displayName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email
        });
      }
    }

    // Surface entries with no linked users so admins can see what was skipped.
    const linkedEntryIds = new Set(userEntries.map(ue => ue.entryId));
    const unresolvedEntryLabels = entries
      .filter(e => !linkedEntryIds.has(e.id))
      .map(e => e.name || e.id);

    return { resolved, unresolvedEntryLabels };
  }
};

module.exports = ParticipantEmailService;
