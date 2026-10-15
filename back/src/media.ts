import { unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const LOCAL_MEDIA_PREFIX = "/api/media/";

const storedFilenamePattern = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export type SupportedImageFormat = {
  extension: "jpg" | "png" | "webp";
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export function detectImageFormat(bytes: Uint8Array): SupportedImageFormat | null {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isJpeg) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }

  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) {
    return { extension: "png", contentType: "image/png" };
  }

  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isWebp) {
    return { extension: "webp", contentType: "image/webp" };
  }

  return null;
}

export function isUploadSizeAllowed(size: number) {
  return size <= MAX_UPLOAD_BYTES;
}

export function getUploadDirectory() {
  return resolve(Bun.env.UPLOAD_DIR ?? "./uploads");
}

export function createStoredFilename(format: SupportedImageFormat) {
  return `${crypto.randomUUID()}.${format.extension}`;
}

export function getLocalMediaFilename(url: string) {
  if (!url.startsWith(LOCAL_MEDIA_PREFIX)) {
    return null;
  }

  const filename = url.slice(LOCAL_MEDIA_PREFIX.length);
  return storedFilenamePattern.test(filename) ? filename : null;
}

export function getStoredFilePath(filename: string, uploadDirectory = getUploadDirectory()) {
  if (!storedFilenamePattern.test(filename)) {
    throw new Error("Invalid stored media filename");
  }

  return join(uploadDirectory, filename);
}

export async function removeLocalMediaFile(
  url: string,
  uploadDirectory = getUploadDirectory(),
) {
  const filename = getLocalMediaFilename(url);
  if (!filename) {
    return false;
  }

  try {
    await unlink(getStoredFilePath(filename, uploadDirectory));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  return true;
}

export function getLocalMediaUrl(filename: string) {
  if (!storedFilenamePattern.test(filename)) {
    throw new Error("Invalid stored media filename");
  }

  return `${LOCAL_MEDIA_PREFIX}${filename}`;
}
