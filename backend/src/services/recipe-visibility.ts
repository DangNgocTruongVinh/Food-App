import type { Prisma } from "@prisma/client";

/**
 * Điều kiện "món còn dùng" (chưa bị Admin ẩn). Dùng ở mọi chỗ chọn món mới: danh sách công thức, tạo thực đơn
 * (OpenAI + thuật toán dự phòng), gắn vào bài viết, gợi ý Dashboard, "Dành cho bạn", số đếm công khai.
 * Không dùng cho trang chi tiết, thực đơn cũ và bài viết cũ (vẫn hiển thị món đã ẩn, kèm cờ hidden).
 */
export const visibleRecipeWhere = { hiddenAt: null } satisfies Prisma.RecipeWhereInput;

export const isRecipeHidden = (recipe: { hiddenAt: Date | null }) => recipe.hiddenAt !== null;

export const HIDDEN_RECIPE_MESSAGE = "Món này đã ngừng sử dụng.";
