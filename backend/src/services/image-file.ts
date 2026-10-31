// Kiểm tra file ảnh tải lên (không phụ thuộc Cloudinary): chỉ jpg/png/webp, nhận dạng theo byte đầu file
// vì mimetype và đuôi file do trình duyệt gửi lên có thể giả mạo.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_IMAGES = 4;
export type ImageFormat = "jpg" | "png" | "webp";

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte);

export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // RIFF....WEBP
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}
