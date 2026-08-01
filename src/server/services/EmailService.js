// Sends the actual tournament update emails via AWS SES, and logs every
// send attempt to EmailBlast for an audit trail admins can review later.
//
// Requires: `npm install nodemailer` (aws-sdk v2 is already bundled in the
// Lambda runtime, but list it in package.json too so `npm install` works
// the same locally).
//
// Before this works you need, in the SES console for this AWS account:
//   1. A verified sending identity (single email address is enough to
//      start) matching SES_FROM_EMAIL below.
//   2. To move the account out of the SES sandbox if you want to send to
//      arbitrary participant addresses rather than only pre-verified ones -
//      sandbox mode caps you at 200 emails/day to verified recipients only.

const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const Tournament = require('../models/Tournament');
const EmailBlast = require('../models/EmailBlast');
const ParticipantEmailService = require('./ParticipantEmailService');
const EmailAttachmentUploadService = require('./EmailAttachmentUploadService');

const ses = new AWS.SES({ region: process.env.AWS_REGION || 'us-west-2' });
const transporter = nodemailer.createTransport({ SES: { ses, aws: AWS } });

const FROM_EMAIL = process.env.SES_FROM_EMAIL;
const ADMIN_EMAILS = ['couvillion@gmail.com', 'david.xesllc@gmail.com', 'bartsched@gmail.com'];

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

    for (const batch of chunk(resolved, BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map((recipient) =>
          transporter.sendMail({
            from: FROM_EMAIL,
            replyTo: ADMIN_EMAILS.join(', '),
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
