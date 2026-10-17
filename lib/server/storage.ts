import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { ApiError } from "./security";

export type UploadRecord = {
  id: string;
  assetId: string;
  workspaceId: string;
  uploadKey: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
};
export interface Storage {
  prepare(record: UploadRecord): Promise<{ url: string; fields: Record<string, string> }>;
  finalize(record: UploadRecord): Promise<{ width: number; height: number }>;
  preview(record: UploadRecord, download: boolean): Promise<string>;
}
let client: S3Client | undefined;
function configuration() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !process.env.AWS_REGION)
    throw new ApiError(
      503,
      "File storage is not configured yet. Ask the workspace owner to connect Amazon S3.",
    );
  client ??= new S3Client({ region: process.env.AWS_REGION, maxAttempts: 2 });
  return { client, bucket };
}
export function detectImageType(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (
    b.length >= 12 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}
export function uploadConditions(record: UploadRecord): [string, ...unknown[]][] {
  return [
    ["content-length-range", record.byteSize, record.byteSize],
    ["eq", "$Content-Type", record.contentType],
    ["eq", "$key", record.uploadKey],
  ];
}
export function orientedDimensions(width: number, height: number, orientation = 1) {
  return orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}
export function asUploadRecord(v: Record<string, unknown>): UploadRecord {
  return {
    id: v.id as string,
    assetId: v.asset_id as string,
    workspaceId: v.workspace_id as string,
    uploadKey: v.upload_key as string,
    storageKey: v.storage_key as string,
    contentType: v.content_type as string,
    byteSize: v.byte_size as number,
    width: v.width as number,
    height: v.height as number,
  };
}
export const s3Storage: Storage = {
  async prepare(record) {
    const { client, bucket } = configuration();
    return createPresignedPost(client, {
      Bucket: bucket,
      Key: record.uploadKey,
      Expires: 300,
      Fields: {
        "Content-Type": record.contentType,
        "x-amz-server-side-encryption": "AES256",
        "x-amz-meta-version-id": record.id,
      },
      Conditions: uploadConditions(record) as Parameters<
        typeof createPresignedPost
      >[1]["Conditions"],
    });
  },
  async finalize(record) {
    const { client, bucket } = configuration();
    let head;
    try {
      head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: record.uploadKey }));
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
        throw new ApiError(409, "The file has not finished uploading. Please retry the upload.");
      throw error;
    }
    if (
      head.ContentLength !== record.byteSize ||
      head.ContentType !== record.contentType ||
      head.Metadata?.["version-id"] !== record.id
    )
      throw new ApiError(422, "The uploaded file does not match the approved upload.");
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: record.uploadKey, IfMatch: head.ETag }),
    );
    const bytes = await object.Body?.transformToByteArray();
    if (
      !bytes ||
      bytes.byteLength !== record.byteSize ||
      detectImageType(bytes) !== record.contentType
    )
      throw new ApiError(422, "This file is not a valid PNG, JPG, or WebP image.");
    let dimensions;
    try {
      const image = await sharp(bytes, { limitInputPixels: 50000000, animated: false }).metadata();
      if (
        !image.width ||
        !image.height ||
        image.width > 20000 ||
        image.height > 20000 ||
        (image.pages ?? 1) > 1
      )
        throw new Error("Unsupported dimensions");
      dimensions = orientedDimensions(image.width, image.height, image.orientation);
    } catch {
      throw new ApiError(
        422,
        "This image could not be read. Use a static image under 50 megapixels and 20,000 pixels per side.",
      );
    }
    // Only the staging key is presigned. Copy to a separate key so a still-valid upload URL cannot replace an approved version.
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: record.storageKey,
        CopySource: `${bucket}/${record.uploadKey}`.split("/").map(encodeURIComponent).join("/"),
        CopySourceIfMatch: head.ETag,
        MetadataDirective: "REPLACE",
        Metadata: { "version-id": record.id, "asset-id": record.assetId },
        ContentType: record.contentType,
        ContentDisposition: "inline",
        ServerSideEncryption: "AES256",
      }),
    );
    return dimensions;
  },
  async preview(record, download) {
    const { client, bucket } = configuration();
    const extension = record.contentType.split("/")[1].replace("jpeg", "jpg");
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: record.storageKey,
        ResponseContentType: record.contentType,
        ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename="design-${record.id}.${extension}"`,
      }),
      { expiresIn: 120 },
    );
  },
};
