import { z } from "zod";
import { allergenLabels, expandRestrictedTerms, findRestrictedTerms } from "../../services/dietary.service.js";

/**
 * Công thức tự viết trong bài cộng đồng (lưu JSON ở CommunityPost.memberRecipe). Không phải Recipe: không vào thực đơn,
 * gợi ý hay kho; số lượng/đơn vị nhập tự do. Giới hạn dùng chung cho Zod và giao diện (frontend giữ cùng số).
 */
export const MEMBER_RECIPE_LIMITS = {
  name: 120,
  servings: 20,
  minutes: 1440,
  ingredients: 30,
  ingredientName: 80,
  quantity: 20,
  unit: 20,
  steps: 20,
  step: 500,
} as const;

const L = MEMBER_RECIPE_LIMITS;

export const memberRecipeSchema = z.object({
  name: z.string().trim().min(2).max(L.name),
  servings: z.number().int().min(1).max(L.servings),
  minutes: z.number().int().min(1).max(L.minutes),
  ingredients: z.array(z.object({
    name: z.string().trim().min(1).max(L.ingredientName),
    quantity: z.string().trim().max(L.quantity).default(""),
    unit: z.string().trim().max(L.unit).default(""),
  }).strict()).min(1).max(L.ingredients),
  steps: z.array(z.string().trim().min(1).max(L.step)).min(1).max(L.steps),
}).strict();

export type MemberRecipe = z.infer<typeof memberRecipeSchema>;

/** Bài đăng kèm ảnh gửi multipart: công thức tự viết đến dưới dạng chuỗi JSON; chuỗi hỏng để Zod báo lỗi kiểu. */
export const memberRecipeField = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, memberRecipeSchema);

/** Đọc lại JSON đã lưu; dữ liệu không đúng dạng (không xảy ra nếu chỉ ghi qua API) coi như không có công thức. */
export function readMemberRecipe(value: unknown): MemberRecipe | null {
  if (value === null || value === undefined) return null;
  const parsed = memberRecipeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Cảnh báo dị ứng cho người xem: so tên món và tên nguyên liệu với dị ứng trong hồ sơ người xem, dùng đúng hàm so khớp của
 * bộ gợi ý (nhóm dị ứng mở rộng, so theo nguyên từ). Chỉ theo từ khóa, chưa kiểm duyệt dinh dưỡng.
 */
export function memberRecipeAllergens(recipe: MemberRecipe | null, allergies: string[]) {
  if (!recipe || !allergies.length) return [];
  const food = { name: recipe.name, ingredients: recipe.ingredients.map(({ name }) => ({ name })) };
  return findRestrictedTerms(food, expandRestrictedTerms(allergies)).length ? allergenLabels(food, allergies) : [];
}
