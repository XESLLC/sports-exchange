const Tournament = require('../models/Tournament');
const Entry = require('../models/Entry');
const UserEntry = require('../models/UserEntry');
const User = require('../models/User');
const TournamentMessage = require('../models/TournamentMessage');
const { sendEmail } = require('../util/sendEmail');

const MAX_MESSAGE_LENGTH = 5000;

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Sole access gate for the board: confirms the authenticated email belongs
// to a User who owns (or co-owns, since Entry <-> User is many-to-many via
// UserEntry) at least one Entry in this tournament. Used by both reads and
// posts - nobody outside the tournament can see or write to its board.
async function verifyTournamentAccess(tournamentId, email) {
  if (!email) {
    throw new Error('Not authenticated');
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new Error('User not found');
  }

  const userEntries = await UserEntry.findAll({ where: { userId: user.id } });
  const entryIds = userEntries.map(userEntry => userEntry.entryId);

  if (entryIds.length < 1) {
    throw new Error('You do not have an entry in this tournament');
  }

  const entries = await Entry.findAll({
    where: {
      id: entryIds,
      tournamentId
    }
  });

  if (entries.length < 1) {
    throw new Error('You do not have an entry in this tournament');
  }

  // A user could in theory co-own more than one entry in the same
  // tournament - just attribute the post to the first one found.
  return { user, entry: entries[0] };
}

function toGraphQLShape(message, entry, author) {
  return {
    id: message.id,
    tournamentId: message.tournamentId,
    entryId: message.entryId,
    entryName: entry ? entry.name : null,
    userId: message.userId,
    authorFirstName: author ? author.firstname : null,
    authorLastName: author ? author.lastname : null,
    body: message.body,
    notifiedByEmail: message.notifiedByEmail,
    createdAt: message.createdAt.toISOString()
  };
}

const MessageBoardService = {
  tournamentMessages: async (tournamentId, email) => {
    await verifyTournamentAccess(tournamentId, email);

    const messages = await TournamentMessage.findAll({
      where: { tournamentId },
      order: [['createdAt', 'ASC']]
    });

    const userIds = [...new Set(messages.map(m => m.userId))];
    const users = userIds.length > 0 ? await User.findAll({ where: { id: userIds } }) : [];
    const usersById = new Map(users.map(u => [u.id, u]));

    const entryIds = [...new Set(messages.map(m => m.entryId).filter(Boolean))];
    const entries = entryIds.length > 0 ? await Entry.findAll({ where: { id: entryIds } }) : [];
    const entriesById = new Map(entries.map(e => [e.id, e]));

    return messages.map(message =>
      toGraphQLShape(message, entriesById.get(message.entryId), usersById.get(message.userId))
    );
  },

  // Creates the post, then (only if sendEmailFlag is set) emails every
  // OTHER entrant in the tournament using the app's existing SES-backed
  // sendEmail util - same one Trade Notifications already use.
  createTournamentMessage: async (tournamentId, email, body, sendEmailFlag) => {
    const trimmedBody = (body || '').trim();
    if (trimmedBody.length < 1) {
      throw new Error('Message cannot be empty');
    }
    if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
    }

    const { user, entry } = await verifyTournamentAccess(tournamentId, email);

    const message = await TournamentMessage.create({
      tournamentId,
      entryId: entry.id,
      userId: user.id,
      body: trimmedBody,
      notifiedByEmail: false
    });

    if (sendEmailFlag) {
      const tournament = await Tournament.findByPk(tournamentId);
      const tournamentEntries = await Entry.findAll({ where: { tournamentId } });
      const tournamentEntryIds = tournamentEntries.map(e => e.id);

      const userEntries = tournamentEntryIds.length > 0
        ? await UserEntry.findAll({ where: { entryId: tournamentEntryIds } })
        : [];

      // Notify every other entrant - not the poster themselves.
      const recipientUserIds = [...new Set(userEntries.map(ue => ue.userId))]
        .filter(id => id !== user.id);

      const recipients = recipientUserIds.length > 0
        ? await User.findAll({ where: { id: recipientUserIds } })
        : [];

      const authorName = `${user.firstname} ${user.lastname}`;
      const tournamentName = tournament ? tournament.name : 'your tournament';
      const emailMessage = `<p><strong>${escapeHtml(authorName)}</strong> posted a new message on the ${escapeHtml(tournamentName)} message board:</p><p>${escapeHtml(trimmedBody)}</p>`;

      for (const recipient of recipients) {
        await sendEmail(recipient.email, 'New Message Board Post', emailMessage);
      }

      message.notifiedByEmail = true;
      await message.save();
    }

    return toGraphQLShape(message, entry, user);
  }
};

module.exports = MessageBoardService;
