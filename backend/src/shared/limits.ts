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

/** Công thức trong thư viện (form món của Admin): [tối thiểu, tối đa]. */
export const RECIPE_LIMITS = {
  name: [2, 120], description: [1, 1000], cuisine: [1, 50], prepMinutes: [0, 600], cookMinutes: [0, 1440], servings: [1, 12],
  calories: [0, 5000], nutrient: [0, 1000], ingredientName: [1, 80], ingredientQuantityMax: 100_000, ingredients: [1, 40],
  step: [1, 500], steps: [1, 20],
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

/**
 * Số của công thức chỉ tiêu dinh dưỡng (backend services/nutrition.service.ts, audit M1). Hồ sơ ghép câu "Cách tính" từ cùng các
 * số này (audit M2) nên giao diện không nói khác công thức.
 */
export const NUTRITION_FORMULA = {
  /** Chưa nhập số đo thì dùng cơ thể mặc định. */
  defaultBody: { age: 25, heightCm: 165, weightKg: 60 },
  /** kcal cộng vào năng lượng tiêu hao: giảm cân trừ, tăng cân/tăng cơ cộng. */
  calorieAdjustment: { loseWeight: -350, gainWeight: 300 },
  minCalories: 1200,
  /** Tỷ lệ năng lượng từ đạm (tăng cơ cao hơn) và béo; phần còn lại là tinh bột. */
  proteinRatio: { default: 0.25, buildMuscle: 0.3 },
  fatRatio: 0.28,
} as const;

/**
 * Hạn (số ngày) cuối cùng khi thực phẩm vào kho mà không có hạn: nhóm thực phẩm và nhóm dự phòng ("Khác") đều chưa đặt hạn mặc định
 * (backend services/pantry-purchase.ts, resolveDefaultExpiry).
 */
export const FALLBACK_SHELF_LIFE_DAYS = 7;

/** Số lượng một thực phẩm trong kho (thêm tay, sửa, dòng hóa đơn): lớn hơn 0, tối đa 100.000 (đơn vị bất kỳ). */
export const PANTRY_QUANTITY_MAX = 100_000;

/**
 * Giới hạn tần suất theo tài khoản (backend đếm trong bộ nhớ, cửa sổ cố định tính từ lần đầu): chống spam cộng đồng và đốt hạn mức
 * AI. Hỏi Nouri (30 câu/ngày) và quét hóa đơn (10 lần/ngày, mọi chế độ) giữ giới hạn theo ngày giờ VN đếm trong database.
 */
export const USER_RATE_LIMITS = {
  /** Đăng bài và sửa bài, chung một bộ đếm (mỗi lần đều gọi AI kiểm duyệt). */
  postWrites: { max: 10, windowMs: 60 * 60_000 },
  comments: { max: 20, windowMs: 10 * 60_000 },
  /** Thích và bỏ thích (cùng một route bật/tắt). */
  likes: { max: 60, windowMs: 60_000 },
  /** "Tạo bằng AI" (thực đơn); vẫn chỉ một việc chạy cùng lúc. */
  aiMealPlans: { max: 10, windowMs: 24 * 60 * 60_000 },
  /** Admin "Chuyển thành công thức": AI ước tính dinh dưỡng. */
  aiRecipeEstimates: { max: 20, windowMs: 24 * 60 * 60_000 },
} as const;
