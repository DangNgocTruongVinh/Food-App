import type { Prisma } from "@prisma/client";

/**
 * Điều kiện "món còn dùng" (chưa bị Admin ẩn). Dùng ở mọi chỗ chọn món mới: danh sách công thức, tạo thực đơn
 * (OpenAI + thuật toán dự phòng), gắn vào bài viết, gợi ý Dashboard, "Dành cho bạn", số đếm công khai.
 * Không dùng cho trang chi tiết, thực đơn cũ và bài viết cũ (vẫn hiển thị món đã ẩn, kèm cờ hidden).
 */
/** Món còn dùng: chưa bị Admin ẩn và chưa bị xóa mềm. */
export const visibleRecipeWhere = { hiddenAt: null, deletedAt: null } satisfies Prisma.RecipeWhereInput;

/** Đã ngừng sử dụng: Admin ẩn hoặc đã xóa mềm (`deletedAt`). */
export const isRecipeHidden = (recipe: { hiddenAt: Date | null; deletedAt?: Date | null }) => recipe.hiddenAt !== null || Boolean(recipe.deletedAt);

export const HIDDEN_RECIPE_MESSAGE = "Món này đã ngừng sử dụng.";
