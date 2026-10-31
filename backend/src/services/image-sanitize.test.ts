import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { exifHasGps, jpegWithGps } from "../test/image-fixtures.js";
import { detectImageFormat } from "./image-file.js";
import { stripImageMetadata } from "./image-sanitize.js";

describe("stripImageMetadata (before uploading post images)", () => {
  it("removes all EXIF including GPS from a JPEG", async () => {
    const original = await jpegWithGps();
    const before = await sharp(original).metadata();
    expect(before.exif).toBeDefined();
    expect(exifHasGps(before.exif)).toBe(true);

    const clean = await stripImageMetadata(original, "jpg");
    const after = await sharp(clean).metadata();
    expect(after.exif).toBeUndefined();
    expect(exifHasGps(after.exif)).toBe(false);
    expect(detectImageFormat(clean)).toBe("jpg");
  });

  it("keeps the photo upright: pixels are rotated by the Orientation tag, then the tag is dropped", async () => {
    const original = await jpegWithGps(64, 32, 6);
    expect(await sharp(original).metadata()).toMatchObject({ width: 64, height: 32, orientation: 6 });
    const after = await sharp(await stripImageMetadata(original, "jpg")).metadata();
    expect(after).toMatchObject({ width: 32, height: 64 });
    expect(after.orientation).toBeUndefined();
  });

  it.each([["png"], ["webp"]] as const)("keeps the %s format without metadata", async (format) => {
    const source = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#fff" } })
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 46/1 0/1" } })
      .toFormat(format)
      .toBuffer();
    const clean = await stripImageMetadata(source, format);
    expect(detectImageFormat(clean)).toBe(format);
    expect((await sharp(clean).metadata()).exif).toBeUndefined();
  });

  it("rejects a broken image with 422", async () => {
    await expect(stripImageMetadata(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]), "jpg"))
      .rejects.toMatchObject({ status: 422 });
  });
});
