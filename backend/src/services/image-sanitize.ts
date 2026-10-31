import sharp from "sharp";
import { HttpError } from "../utils/http-error.js";
import type { ImageFormat } from "./image-file.js";

// Ảnh do người dùng tải lên có thể chứa EXIF (vị trí GPS, thiết bị, thời gian chụp). Trước khi lưu lên Cloudinary,
// ảnh được giải mã và mã hóa lại bằng sharp: xoay điểm ảnh theo tag Orientation (để ảnh vẫn đúng chiều khi bỏ tag)
// rồi ghi ra KHÔNG kèm metadata (sharp chỉ giữ metadata khi gọi withMetadata/keepMetadata). Bản gốc trên Cloudinary
// vì vậy không còn EXIF/GPS. Đổi lại ảnh được nén lại một lần (chất lượng 90).

// Chặn ảnh "bom giải nén" (kích thước khai báo cực lớn) dù file nhỏ hơn 5 MB.
const MAX_INPUT_PIXELS = 40_000_000;

export async function stripImageMetadata(buffer: Buffer, format: ImageFormat) {
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    if (format === "jpg") return await image.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    if (format === "png") return await image.png().toBuffer();
    return await image.webp({ quality: 90 }).toBuffer();
  } catch {
    throw new HttpError(422, "Ảnh bị lỗi hoặc quá lớn, không đọc được.");
  }
}
