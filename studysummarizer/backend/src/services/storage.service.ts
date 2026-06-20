// backend/src/services/storage.service.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadToS3(
  filePath: string,
  originalName: string,
  userId: string,
  mimeType: string
): Promise<{ s3Key: string; s3Url: string }> {
  const ext = path.extname(originalName);
  const s3Key = `users/${userId}/documents/${uuidv4()}${ext}`;

  const fileBuffer = fs.readFileSync(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: {
        originalName,
        userId,
      },
    })
  );

  // Generate a signed URL valid for 7 days
  const s3Url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    { expiresIn: 7 * 24 * 60 * 60 }
  );

  return { s3Key, s3Url };
}

// ── Get signed URL ────────────────────────────────────────────────────────────

export async function getSignedDownloadUrl(
  s3Key: string,
  expiresInSeconds = 3600
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
    { expiresIn: expiresInSeconds }
  );
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteFromS3(s3Key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    })
  );
}
