import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { detectImageFormat, MAX_IMAGE_BYTES, MAX_POST_IMAGES } from "../services/image-file.js";
import { isImageUploadConfigured, uploadNotConfiguredError } from "../services/image-upload.service.js";
import { HttpError } from "../utils/http-error.js";

const postImages = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_POST_IMAGES } })
  .array("images", MAX_POST_IMAGES);

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

/**
 * Ảnh kèm bài viết (trường "images", tối đa 4). Chỉ đọc khi gửi multipart; gửi JSON như cũ thì bỏ qua.
 * Có ảnh mà chưa cấu hình Cloudinary → 503; bài không ảnh vẫn đăng được. Mỗi ảnh kiểm tra định dạng theo byte đầu file.
 */
export function communityPostImagesUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.is("multipart/form-data")) return next();
  postImages(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooMany = error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE";
      return next(new HttpError(422, error.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá 5 MB."
        : tooMany ? `Mỗi bài tối đa ${MAX_POST_IMAGES} ảnh.` : "Tệp tải lên không hợp lệ."));
    }
    if (error) return next(error);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length && !isImageUploadConfigured()) return next(uploadNotConfiguredError());
    if (files.some((file) => !detectImageFormat(file.buffer))) return next(new HttpError(422, "Chỉ nhận ảnh JPG, PNG hoặc WEBP."));
    next();
  });
}
