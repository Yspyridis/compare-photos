import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  DeleteObjectsCommand,
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

let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;

  const bucket = process.env.AWS_BUCKET!;

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const code =
      (e?.name as string) ?? (e?.Code as string) ?? (e?.code as string) ?? "";
    const meta = e?.$metadata as Record<string, unknown> | undefined;
    const status = meta?.httpStatusCode as number | undefined;

    // 404 / NoSuchBucket means it doesn't exist — create it.
    // Any other error (auth, network, …) we re-throw so the caller sees it.
    if (code === "NoSuchBucket" || code === "NotFound" || status === 404) {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    } else {
      throw err;
    }
  }

  bucketReady = true;
}

/**
 * Detect image MIME type from the first 4 magic bytes of the buffer.
 * Falls back to `provided` if it is already a non-empty string.
 * Throws if the buffer is neither JPEG nor PNG.
 */
function resolveMimeType(buffer: Buffer, provided: string): string {
  if (provided && provided.trim() !== "") return provided;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  throw new Error(
    "Unsupported image format. Please upload a JPEG or PNG file.",
  );
}

export async function processAndUploadImage(buffer: Buffer, mimeType: string) {
  await ensureBucket();

  const resolvedMimeType = resolveMimeType(buffer, mimeType);
  const fileId = crypto.randomUUID();
  const rawKey = `raw/${fileId}`;
  const thumbKey = `thumb/${fileId}`;

  // Strip EXIF metadata for the blind version
  const strippedBuffer = await sharp(buffer)
    .rotate() // Auto-rotates based on EXIF before stripping it
    .withMetadata({ exif: {} })
    .toBuffer();

  const thumbBuffer = await sharp(buffer).rotate().resize(400).toBuffer();

  await Promise.all([
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: rawKey,
        Body: strippedBuffer,
        ContentType: resolvedMimeType,
      }),
    ),
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: thumbKey,
        Body: thumbBuffer,
        ContentType: resolvedMimeType,
      }),
    ),
  ]);

  return { rawKey, thumbKey };
}

export async function deleteS3Objects(keys: string[]) {
  if (keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: process.env.AWS_BUCKET,
      Delete: {
        Objects: keys.map((k) => ({ Key: k })),
        Quiet: true,
      },
    }),
  );
}

export async function getSignedImageUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn: 3600 });
}
