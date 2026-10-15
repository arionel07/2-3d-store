import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_UPLOAD_BYTES,
  detectImageFormat,
  getLocalMediaUrl,
  isUploadSizeAllowed,
  removeLocalMediaFile,
} from "./media.ts";

describe("local media uploads", () => {
  test("detects supported image content signatures", () => {
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))?.extension).toBe("jpg");
    expect(detectImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.extension).toBe("png");
    expect(detectImageFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]))?.extension).toBe("webp");
  });

  test("rejects unsupported content regardless of filename", () => {
    expect(detectImageFormat(new TextEncoder().encode("not an image"))).toBeNull();
  });

  test("enforces the 10 MB limit", () => {
    expect(isUploadSizeAllowed(MAX_UPLOAD_BYTES)).toBe(true);
    expect(isUploadSizeAllowed(MAX_UPLOAD_BYTES + 1)).toBe(false);
  });

  test("removes only the matching local file", async () => {
    const uploadDirectory = await mkdtemp(join(tmpdir(), "store-layout-media-"));
    const filename = "00000000-0000-0000-0000-000000000001.png";
    const filePath = join(uploadDirectory, filename);
    await Bun.write(filePath, new Uint8Array([1, 2, 3]));

    expect(await removeLocalMediaFile(getLocalMediaUrl(filename), uploadDirectory)).toBe(true);
    await expect(readFile(filePath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await removeLocalMediaFile("https://example.com/image.png", uploadDirectory)).toBe(false);

    await rm(uploadDirectory, { recursive: true, force: true });
  });
});
