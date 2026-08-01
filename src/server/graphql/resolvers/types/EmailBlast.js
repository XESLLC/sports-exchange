const EmailService = require('../../services/EmailService');
const EmailAttachmentUploadService = require('../../services/EmailAttachmentUploadService');

// ADJUST: fix these relative paths to match wherever this file actually
// lands in your resolvers tree (mirrors the depth of
// src/server/graphql/resolvers/types/Tournament.js from the dividend patch).

const EmailBlastResolvers = {
  Query: {
    emailBlasts: async (_, { tournamentId }) => {
      return EmailService.getEmailBlasts(tournamentId);
    }
  },
  Mutation: {
    sendTournamentEmail: async (_, { input }, context) => {
      // ADJUST: this assumes your Apollo context already attaches the
      // authenticated Auth0 user (same as whatever other authenticated
      // mutations in this codebase rely on) - match that shape here.
      const senderId = context && context.user ? context.user.sub : null;
      const senderName = context && context.user ? context.user.name : null;
      return EmailService.sendTournamentEmail({ ...input, senderId, senderName });
    },
    getEmailAttachmentUploadUrl: async (_, { input }) => {
      return EmailAttachmentUploadService.getPresignedUploadUrl(
        input.tournamentId,
        input.filename,
        input.contentType
      );
    }
  }
};

module.exports = EmailBlastResolvers;
