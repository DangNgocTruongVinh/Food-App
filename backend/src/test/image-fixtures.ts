import sharp from "sharp";

/** Ảnh JPEG thử có EXIF: hãng máy, toạ độ GPS (TP.HCM) và tag xoay (mặc định 6 = xoay 90°). */
export function jpegWithGps(width = 64, height = 32, orientation = 6) {
  return sharp({ create: { width, height, channels: 3, background: "#4a8" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "NouriTest" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "10/1 46/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "106/1 41/1 0/1" },
    })
    .withMetadata({ orientation })
    .toBuffer();
}

/** EXIF có con trỏ tới khối GPS (tag 0x8825, đọc được cả hai thứ tự byte). */
export function exifHasGps(exif: Buffer | undefined) {
  return Boolean(exif && (exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]))));
}
