// Sends the actual tournament update emails via AWS SES, and logs every
// send attempt to EmailBlast for an audit trail admins can review later.
//
// Requires: `nodemailer` and `@aws-sdk/client-sesv2` in package.json
// (bundled into the deploy package - the nodejs14.x runtime does not ship
// the v3 SDK). nodemailer 9's SES transport expects a v2 SES client.
//
// Before this works you need, in the SES console for this AWS account:
//   1. A verified sending identity (single email address is enough to
//      start) matching SES_FROM_EMAIL below.
//   2. To move the account out of the SES sandbox if you want to send to
//      arbitrary participant addresses rather than only pre-verified ones -
//      sandbox mode caps you at 200 emails/day to verified recipients only.

const nodemailer = require('nodemailer');
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const Tournament = require('../models/Tournament');
const EmailBlast = require('../models/EmailBlast');
const ParticipantEmailService = require('./ParticipantEmailService');
const EmailAttachmentUploadService = require('./EmailAttachmentUploadService');

const FROM_EMAIL = process.env.SES_FROM_EMAIL;
// Display name shown in recipients' inboxes (the address has no inbox).
const FROM_NAME = 'Stock Exchange Commissioner';
// Where replies to a tournament email blast go. The From address
// (commissioner@fantasysportsstockexchange.com) has no inbox, so a
// participant hitting "reply" reaches these people directly.
const REPLY_TO_EMAILS = ['couvillion@gmail.com', 'couvya@gmail.com', 'mmsegeneral@gmail.com'];

// Lazy-initialized so the SES client isn't created at module load time.
// nodemailer 9 dropped the aws-sdk v2 SES transport; it now wants an
// @aws-sdk/client-sesv2 client + the SendEmailCommand class.
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    const sesClient = new SESv2Client({ region: process.env.AWS_REGION || 'us-west-2' });
    _transporter = nodemailer.createTransport({ SES: { sesClient, SendEmailCommand } });
  }
  return _transporter;
}

// SES will throttle a burst of 30+ simultaneous sends (especially in
// sandbox mode, where the default is 1 msg/sec). Batch it instead of
// firing everything at once.
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EmailService = {
  // attachmentKeys: S3 keys returned earlier by getEmailAttachmentUploadUrl -
  // these are REAL file attachments (e.g. a PDF ruleset). Inline images/gifs
  // meant to show up in the body itself should already be embedded as
  // <img src="https://..."> tags inside htmlBody by the frontend editor;
  // don't pass those here.
  sendTournamentEmail: async ({ tournamentId, subject, htmlBody, attachmentKeys = [], senderId, senderName }) => {
    if (!FROM_EMAIL) {
      throw new Error('SES_FROM_EMAIL env var is not set - verify a sending identity in SES first');
    }

    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) {
      throw new Error(`tournament not found for id: ${tournamentId}`);
    }

    const { resolved, unresolvedEntryLabels } = await ParticipantEmailService.getParticipantEmails(tournamentId);

    if (resolved.length === 0) {
      return EmailBlast.create({
        tournamentId,
        subject,
        htmlBody,
        senderId,
        senderName,
        recipientCount: 0,
        failedCount: 0,
        unresolvedParticipants: unresolvedEntryLabels,
        attachments: [],
        status: 'failed',
        errorMessage: 'No participant email addresses could be resolved'
      });
    }

    // Fetch attachment bytes once, reuse across every recipient's send.
    const attachments = [];
    for (const key of attachmentKeys) {
      const buffer = await EmailAttachmentUploadService.getObjectBuffer(key);
      attachments.push({ filename: key.split('/').pop(), content: buffer });
    }

    let failedCount = 0;
    const failedEmails = [];
    const transporter = getTransporter();

    for (const batch of chunk(resolved, BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((recipient) =>
          transporter.sendMail({
            from: { name: FROM_NAME, address: FROM_EMAIL },
            replyTo: REPLY_TO_EMAILS.join(', '),
            to: recipient.email,
            subject,
            html: htmlBody,
            attachments
          })
        )
      );
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          failedCount += 1;
          failedEmails.push(batch[i].email);
        }
      });
      await sleep(BATCH_DELAY_MS);
    }

    const status = failedCount === 0 ? 'sent' : failedCount === resolved.length ? 'failed' : 'partial';

    return EmailBlast.create({
      tournamentId,
      subject,
      htmlBody,
      senderId,
      senderName,
      recipientCount: resolved.length - failedCount,
      failedCount,
      unresolvedParticipants: [...unresolvedEntryLabels, ...failedEmails],
      attachments: attachmentKeys.map((key) => ({ key, filename: key.split('/').pop() })),
      status,
      errorMessage: failedCount > 0 ? `${failedCount} send(s) failed - see unresolvedParticipants` : null
    });
  },

  getEmailBlasts: async (tournamentId) => {
    return EmailBlast.findAll({
      where: { tournamentId },
      order: [['createdAt', 'DESC']]
    });
  }
};

module.exports = EmailService;
