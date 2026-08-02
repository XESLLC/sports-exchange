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

  return { user, entry: entries[0] };
}

function toGraphQLShape(message, entry, author, replies = []) {
  return {
    id: message.id,
    tournamentId: message.tournamentId,
    entryId: message.entryId,
    entryName: entry ? entry.name : null,
    userId: message.userId,
    authorFirstName: author ? author.firstname : null,
    authorLastName: author ? author.lastname : null,
    title: message.title || null,
    body: message.body,
    parentId: message.parentId || null,
    replies,
    notifiedByEmail: message.notifiedByEmail,
    createdAt: message.createdAt.toISOString()
  };
}

const MessageBoardService = {
  tournamentMessages: async (tournamentId, email) => {
    await verifyTournamentAccess(tournamentId, email);

    const allMessages = await TournamentMessage.findAll({
      where: { tournamentId },
      order: [['createdAt', 'ASC']]
    });

    const userIds = [...new Set(allMessages.map(m => m.userId))];
    const users = userIds.length > 0 ? await User.findAll({ where: { id: userIds } }) : [];
    const usersById = new Map(users.map(u => [u.id, u]));

    const entryIds = [...new Set(allMessages.map(m => m.entryId).filter(Boolean))];
    const entries = entryIds.length > 0 ? await Entry.findAll({ where: { id: entryIds } }) : [];
    const entriesById = new Map(entries.map(e => [e.id, e]));

    // Build reply map: parentId -> list of shaped replies
    const replyMap = new Map();
    for (const message of allMessages) {
      if (message.parentId) {
        if (!replyMap.has(message.parentId)) replyMap.set(message.parentId, []);
        replyMap.get(message.parentId).push(
          toGraphQLShape(message, entriesById.get(message.entryId), usersById.get(message.userId))
        );
      }
    }

    // Return only top-level threads with their replies attached
    return allMessages
      .filter(m => !m.parentId)
      .map(m => toGraphQLShape(
        m,
        entriesById.get(m.entryId),
        usersById.get(m.userId),
        replyMap.get(m.id) || []
      ));
  },

  createTournamentMessage: async (tournamentId, email, title, body, parentId) => {
    const trimmedBody = (body || '').trim();
    if (trimmedBody.length < 1) {
      throw new Error('Message cannot be empty');
    }
    if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`);
    }

    const trimmedTitle = (title || '').trim() || null;
    if (!parentId && !trimmedTitle) {
      throw new Error('New threads must have a title');
    }

    const { user, entry } = await verifyTournamentAccess(tournamentId, email);

    const message = await TournamentMessage.create({
      tournamentId,
      entryId: entry.id,
      userId: user.id,
      title: trimmedTitle,
      body: trimmedBody,
      parentId: parentId || null,
      notifiedByEmail: false
    });

    // Email opted-in users about new top-level threads only
    if (!parentId) {
      const tournament = await Tournament.findByPk(tournamentId);
      const tournamentEntries = await Entry.findAll({ where: { tournamentId } });
      const tournamentEntryIds = tournamentEntries.map(e => e.id);

      const userEntries = tournamentEntryIds.length > 0
        ? await UserEntry.findAll({ where: { entryId: tournamentEntryIds } })
        : [];

      const recipientUserIds = [...new Set(userEntries.map(ue => ue.userId))]
        .filter(id => id !== user.id);

      const recipients = recipientUserIds.length > 0
        ? await User.findAll({ where: { id: recipientUserIds, notifyOnMessageBoard: true } })
        : [];

      if (recipients.length > 0) {
        const authorName = `${user.firstname} ${user.lastname}`;
        const tournamentName = tournament ? tournament.name : 'your tournament';
        const subject = `New post on ${tournamentName} message board: ${trimmedTitle}`;
        const emailBody = `<p><strong>${escapeHtml(authorName)}</strong> posted a new thread on the <strong>${escapeHtml(tournamentName)}</strong> message board:</p><h3>${escapeHtml(trimmedTitle)}</h3><p>${escapeHtml(trimmedBody)}</p>`;

        for (const recipient of recipients) {
          await sendEmail(recipient.email, subject, emailBody);
        }

        message.notifiedByEmail = true;
        await message.save();
      }
    }

    return toGraphQLShape(message, entry, user);
  }
};

module.exports = MessageBoardService;
