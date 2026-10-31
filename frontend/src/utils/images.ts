/** Chiều rộng hiển thị tối đa (px) theo vị trí ảnh; Cloudinary trả ảnh không rộng hơn mức này. */
export const IMAGE_WIDTHS = { thumb: 160, card: 640, hero: 1200 } as const;

const CLOUDINARY_PREFIX = "https://res.cloudinary.com/";
const UPLOAD_SEGMENT = "/image/upload/";

/**
 * URL hiển thị đã tối ưu cho ảnh Cloudinary (công thức, bài viết): định dạng tự chọn (f_auto), chất lượng tự chọn
 * (q_auto), giới hạn chiều rộng (c_limit, w_...). Ảnh khác (/assets/...) giữ nguyên; URL đã có biến đổi thì không thêm lần nữa.
 */
/** Ảnh đã tải lên Cloudinary (ảnh thật). Ảnh nhóm /assets/... của dữ liệu mẫu không tính là ảnh của món. */
export function isUploadedImageUrl(url: string | null | undefined): url is string {
  return Boolean(url && url.startsWith(CLOUDINARY_PREFIX) && url.includes(UPLOAD_SEGMENT));
}

export function optimizedImageUrl(url: string, width: number) {
  const index = url.indexOf(UPLOAD_SEGMENT);
  if (!url.startsWith(CLOUDINARY_PREFIX) || index < 0) return url;
  const head = url.slice(0, index + UPLOAD_SEGMENT.length);
  const tail = url.slice(index + UPLOAD_SEGMENT.length);
  if (/^[a-z]_[^/]*\//.test(tail) && !/^v\d+\//.test(tail)) return url;
  return `${head}f_auto,q_auto,c_limit,w_${Math.round(width)}/${tail}`;
}
