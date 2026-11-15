/**
 * Giới hạn nhập liệu và quy tắc nghiệp vụ dùng chung backend–frontend (một nguồn: giao diện báo lỗi đúng như API kiểm tra).
 * BẢN GỐC: backend/src/shared/limits.ts; frontend/src/features/shared/limits.ts là bản chép y nguyên (test frontend so hai file,
 * sửa ở đây rồi chép sang). Không import gì để hai phía dùng được. Danh mục (dị ứng, nhóm thực phẩm…) nằm trong database, không ở đây.
 */

/** Mật khẩu 8–72 ký tự (bcrypt chỉ dùng 72 byte đầu). */
export const PASSWORD_LIMITS = { min: 8, max: 72 } as const;
/** Tên hiển thị của tài khoản. */
export const NAME_LIMITS = { min: 2, max: 80 } as const;

export const PROFILE_LIMITS = {
  name: NAME_LIMITS,
  age: { min: 13, max: 120 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 25, max: 400 },
  listItemMax: 60,
  allergies: 30,
  dislikedFoods: 30,
  preferredCuisines: 20,
} as const;

/** Công thức tự viết trong bài cộng đồng. */
export const MEMBER_RECIPE_LIMITS = {
  name: 120, servings: 20, minutes: 1440, ingredients: 30, ingredientName: 80, quantity: 20, unit: 20, steps: 20, step: 500,
} as const;

export const COMMUNITY_POST_MAX_LENGTH = 2000;
export const COMMUNITY_COMMENT_MAX_LENGTH = 500;

/** Ảnh tải lên (bài viết, ảnh món, hóa đơn): JPG/PNG/WEBP, mỗi ảnh tối đa 5 MB; bài viết tối đa 4 ảnh. */
export const MAX_IMAGE_MB = 5;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
export const MAX_POST_IMAGES = 4;
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** "Sắp hết hạn" = còn ≤ 3 ngày: nhãn Kho, thông báo, gợi ý món dùng đồ sắp hết hạn, trợ lý AI. */
export const EXPIRING_SOON_DAYS = 3;
