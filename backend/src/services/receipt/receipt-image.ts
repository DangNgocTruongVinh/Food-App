import sharp from "sharp";
import { HttpError } from "../../utils/http-error.js";
import { MAX_INPUT_PIXELS } from "../image-sanitize.js";

// Ảnh hóa đơn chỉ dùng để đọc rồi bỏ (GĐ3c): không ghi đĩa, không lưu lên Cloudinary. sharp xoay theo EXIF rồi mã hóa lại
// KHÔNG kèm metadata (xóa EXIF/GPS), thu nhỏ để giảm thời gian đọc và dung lượng gửi đi.
// "ocr": ảnh xám, tăng tương phản, PNG cạnh dài ≤ 2400 px (Tesseract). "vision": JPEG màu cạnh dài ≤ 2000 px (OpenAI, phần 2).

const LONG_SIDE = { ocr: 2400, vision: 2000 } as const;

export async function prepareReceiptImage(buffer: Buffer, mode: keyof typeof LONG_SIDE) {
  try {
    const size = LONG_SIDE[mode];
    const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true });
    return mode === "ocr" ? await image.greyscale().normalize().png().toBuffer() : await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  } catch {
    throw new HttpError(422, "Ảnh bị lỗi hoặc quá lớn, không đọc được.");
  }
}
