import { describe, expect, it } from "vitest";
import { detectImageFormat } from "./image-file.js";

export const imageBytes = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]),
  webp: Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from("WEBPVP8 ")]),
  gif: Buffer.from("GIF89a\x01\x00\x01\x00"),
  text: Buffer.from("day khong phai la anh"),
};

describe("detectImageFormat (by file signature, not by name or mimetype)", () => {
  it.each([["jpg"], ["png"], ["webp"]] as const)("recognises %s", (format) => {
    expect(detectImageFormat(imageBytes[format])).toBe(format);
  });

  it("rejects other formats, text files and a RIFF file that is not WEBP", () => {
    expect(detectImageFormat(imageBytes.gif)).toBeNull();
    expect(detectImageFormat(imageBytes.text)).toBeNull();
    expect(detectImageFormat(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")]))).toBeNull();
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
  });
});
