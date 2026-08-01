// Lets the frontend upload attachment/inline-image files directly to S3
// (bypassing Lambda entirely, so a gif or a few photos don't run into
// Lambda's payload size limits) via a short-lived presigned PUT URL.
//
// Requires an S3 bucket + IAM permissions - see the serverless.yml snippet
// in the integration notes. `aws-sdk` v2 is bundled into the Lambda Node
// runtime by default, but add it to package.json too so it works locally.

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3({ region: process.env.AWS_REGION || 'us-west-2' });
const BUCKET = process.env.EMAIL_ATTACHMENTS_BUCKET;

const EmailAttachmentUploadService = {
  getPresignedUploadUrl: async (tournamentId, filename, contentType) => {
    if (!BUCKET) {
      throw new Error('EMAIL_ATTACHMENTS_BUCKET env var is not set');
    }
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `email-attachments/${tournamentId}/${uuidv4()}-${safeFilename}`;

    const uploadUrl = await s3.getSignedUrlPromise('putObject', {
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      Expires: 900 // 15 minutes
    });

    // NOTE: this assumes the `email-attachments/*` prefix has public-read
    // access (fine for tournament update images/gifs - nothing sensitive).
    // If you'd rather keep the bucket fully private, swap this for a second
    // presigned GET URL generated on read, or front it with CloudFront.
    const publicUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${key}`;

    return { uploadUrl, key, publicUrl };
  },

  // Fetches an uploaded attachment's bytes so EmailService can attach it
  // to the outgoing MIME message as a real attachment (not just a link).
  getObjectBuffer: async (key) => {
    const result = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();
    return result.Body;
  }
};

module.exports = EmailAttachmentUploadService;
