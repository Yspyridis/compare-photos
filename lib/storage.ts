import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
});

export async function processAndUploadImage(file: Buffer, mimeType: string) {
  const fileId = crypto.randomUUID();
  const rawKey = `raw/${fileId}`;
  const thumbKey = `thumb/${fileId}`;

  // Strip EXIF metadata for the blind version
  const strippedBuffer = await sharp(file)
    .rotate() // Auto-rotates based on EXIF before stripping it
    .withMetadata({ exif: {} })
    .toBuffer();

  const thumbBuffer = await sharp(file).rotate().resize(400).toBuffer();

  await Promise.all([
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: rawKey,
        Body: strippedBuffer,
        ContentType: mimeType,
      }),
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: mimeType,
      }),
    ),
  ]);

  return { rawKey, thumbKey };
}

export async function getSignedImageUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}
