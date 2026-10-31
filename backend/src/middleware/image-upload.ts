import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { detectImageFormat, MAX_IMAGE_BYTES } from "../services/image-file.js";
import { isImageUploadConfigured, uploadNotConfiguredError } from "../services/image-upload.service.js";
import { HttpError } from "../utils/http-error.js";

const singleImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single("image");

/**
 * Nhận một ảnh ở trường "image" (multipart, giữ trong bộ nhớ). Chưa cấu hình Cloudinary → 503 trước khi đọc file.
 * Quá 5 MB, không có file hoặc không phải jpg/png/webp (theo byte đầu file) → 422.
 */
export function singleImageUpload(req: Request, res: Response, next: NextFunction) {
  if (!isImageUploadConfigured()) return next(uploadNotConfiguredError());
  singleImage(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      return next(new HttpError(422, error.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá 5 MB." : "Tệp tải lên không hợp lệ."));
    }
    if (error) return next(error);
    if (!req.file) return next(new HttpError(422, "Chưa chọn ảnh."));
    if (!detectImageFormat(req.file.buffer)) return next(new HttpError(422, "Chỉ nhận ảnh JPG, PNG hoặc WEBP."));
    next();
  });
}
