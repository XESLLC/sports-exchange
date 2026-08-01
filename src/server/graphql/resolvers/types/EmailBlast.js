const EmailService = require('../../../services/EmailService');
const EmailAttachmentUploadService = require('../../../services/EmailAttachmentUploadService');

const EmailBlastResolvers = {
  Query: {
    emailBlasts: async (_, { tournamentId }) => {
      return EmailService.getEmailBlasts(tournamentId);
    }
  },
  Mutation: {
    sendTournamentEmail: async (_, { input }, context) => {
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
