import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

// Lưu ảnh trên Cloudinary. Không cấu hình (thiếu biến CLOUDINARY_*) thì chỉ chức năng tải ảnh trả 503.

export const IMAGE_FOLDERS = { recipes: "nouri/recipes", posts: "nouri/posts" } as const;
export type ImageFolder = (typeof IMAGE_FOLDERS)[keyof typeof IMAGE_FOLDERS];
export type UploadedImage = { url: string; publicId: string };

export function isImageUploadConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

export const uploadNotConfiguredError = () => new HttpError(503, "Chức năng tải ảnh chưa được cấu hình.");

let configured = false;
function client() {
  if (!isImageUploadConfigured()) throw uploadNotConfiguredError();
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

/** Tải ảnh (đã kiểm tra định dạng) lên thư mục của dự án; lỗi từ Cloudinary → 502, không lộ chi tiết. */
export async function uploadImage(buffer: Buffer, folder: ImageFolder): Promise<UploadedImage> {
  const uploader = client().uploader;
  return new Promise((resolve, reject) => {
    const stream = uploader.upload_stream({ folder, resource_type: "image", overwrite: false }, (error, result) => {
      if (error || !result) {
        console.error(error ?? new Error("Cloudinary không trả kết quả upload."));
        return reject(new HttpError(502, "Không tải được ảnh lên, vui lòng thử lại."));
      }
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

/** Xóa ảnh theo publicId (dọn ảnh cũ/ảnh thừa): lỗi chỉ ghi log, không làm hỏng thao tác chính. */
export async function deleteImageQuietly(publicId: string | null | undefined) {
  if (!publicId || !isImageUploadConfigured()) return;
  try {
    await client().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (error) {
    console.error(error);
  }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Ảnh hợp lệ của dự án: ảnh nhóm món có sẵn (/assets/...) hoặc ảnh trên Cloudinary của đúng cloud name,
 * trong thư mục nouri/ (có thể kèm phần biến đổi và phiên bản trong URL).
 */
export function isProjectImageUrl(url: string) {
  if (/^\/assets\/[\w.-]+$/.test(url)) return true;
  const cloud = env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return false;
  return new RegExp(`^https://res\\.cloudinary\\.com/${escapeRegExp(cloud)}/image/upload/(?:[^/?#]+/)*?nouri/[\\w./-]+$`).test(url);
}
