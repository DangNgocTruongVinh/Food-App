import type { DietType, MealType } from "@prisma/client";
import { recipeWarnings } from "../../services/recipe-fit.service.js";
import { isRecipeHidden } from "../../services/recipe-visibility.js";

// Lọc an toàn dùng chung cho mọi chỗ gợi ý (GĐ3b-R, bước đầu của bộ trộn): món đang hiện, không chứa thành phần dị ứng
// (theo nhóm), không chứa món người dùng không thích, đúng chế độ chay/thuần chay, đúng bữa (nếu ngữ cảnh có bữa).
// Chỉ ghép các hàm có sẵn (recipe-fit.service, dietary.service, recipe-visibility), không viết lại quy tắc.

export type SafetyProfile = { dietType?: DietType | null; allergies?: string[]; dislikedFoods?: string[] } | null | undefined;
export type SafetyRecipe = {
  name: string;
  dietTags: DietType[];
  mealTypes?: MealType[];
  hiddenAt?: Date | null;
  ingredients: Array<{ name: string }>;
};
export type SafetyContext = { mealType?: MealType };

/** Món chưa khai báo bữa (mealTypes rỗng) dùng được cho mọi bữa (cùng quy ước với meal-plan-generator). */
export const fitsMealType = (recipe: Pick<SafetyRecipe, "mealTypes">, mealType?: MealType) =>
  !mealType || !recipe.mealTypes?.length || recipe.mealTypes.includes(mealType);

/** Độ phù hợp của món với hồ sơ: các vi phạm (để hiện nhãn) và `safe` (không vi phạm gì, gợi ý được). */
export function recipeFit(recipe: SafetyRecipe, profile: SafetyProfile) {
  const warnings = recipeWarnings(recipe, profile);
  return {
    ...warnings,
    safe: !warnings.allergens.length && !warnings.dislikedFoods.length && !warnings.dietConflict,
  };
}

/** Lọc cứng: món ẩn, dị ứng, không thích, trái chế độ ăn, sai bữa đều bị loại. */
export function isRecipeSafe(recipe: SafetyRecipe, profile: SafetyProfile, context: SafetyContext = {}) {
  if (recipe.hiddenAt !== undefined && isRecipeHidden({ hiddenAt: recipe.hiddenAt })) return false;
  return fitsMealType(recipe, context.mealType) && recipeFit(recipe, profile).safe;
}

export function safeRecipes<T extends SafetyRecipe>(recipes: T[], profile: SafetyProfile, context: SafetyContext = {}) {
  return recipes.filter((recipe) => isRecipeSafe(recipe, profile, context));
}
