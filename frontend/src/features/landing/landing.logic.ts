import type { FeaturedRecipe, RecipeStats } from "../../types";
import { loginPath } from "../auth/auth.logic";
import { mealLabels } from "../meal-plans/meal-plans.logic";
import { recipeDetailPath, recipeDietLabel, recipeTotalMinutes } from "../recipes/recipes.logic";

/** Nhóm món có số thật từ GET /api/recipes/stats, khớp nhãn thật của công thức (bữa ăn, chế độ ăn). */
export const LANDING_RECIPE_GROUPS = [
  ["breakfast", "Bữa sáng"], ["vegetarian", "Món chay"], ["vegan", "Thuần chay"], ["lowCarb", "Ít tinh bột"], ["highProtein", "Giàu đạm"],
] as const satisfies ReadonlyArray<readonly [keyof RecipeStats, string]>;

/** Số món theo nhóm; chưa tải được số thì trả mảng rỗng (ẩn, không hiện số giả). Số 0 thật vẫn hiện. */
export function landingRecipeGroups(stats: RecipeStats | undefined) {
  return stats ? LANDING_RECIPE_GROUPS.map(([key, label]) => ({ key, label, count: stats[key] })) : [];
}

/** Câu dẫn của phần "Món trong Nouri": có tổng thật thì nêu số, chưa có thì không nêu. */
export function landingRecipeIntro(stats: RecipeStats | undefined) {
  const detail = "Mỗi món ghi rõ nguyên liệu, các bước làm, calo và đạm, tinh bột, béo cho một khẩu phần.";
  return stats ? `Nouri đang có ${stats.total} món, chủ yếu là món Việt nấu ở nhà. ${detail}` : `Món Việt nấu ở nhà và một số món nước ngoài. ${detail}`;
}

/** Số món tải về cho phần "Món trong Nouri" (6 thẻ). */
export const LANDING_FEATURED_LIMIT = 6;

/** Liên kết tới một trang trong ứng dụng: khách sang đăng nhập rồi quay lại đúng trang đó; đã đăng nhập thì mở thẳng. */
export function landingLink(path: string, signedIn: boolean) {
  return signedIn ? path : loginPath({ next: path });
}

/** Khách bấm món: sang đăng nhập rồi mở đúng món; đã đăng nhập: mở thẳng trang chi tiết. */
export function featuredRecipeLink(recipe: Pick<FeaturedRecipe, "id">, signedIn: boolean) {
  return landingLink(recipeDetailPath(recipe.id), signedIn);
}

/** Thông tin ngắn trên thẻ món: thời gian, calo, bữa đầu tiên, nhãn chế độ ăn (bỏ "Cân bằng" vì món nào cũng có). */
export function featuredRecipeFacts(recipe: FeaturedRecipe) {
  const diet = recipe.dietTags.find((tag) => tag !== "BALANCED");
  const meal = recipe.mealTypes[0];
  return {
    minutes: recipeTotalMinutes(recipe),
    calories: recipe.calories,
    tags: [meal ? mealLabels[meal] : null, diet ? recipeDietLabel(diet) : null].filter((tag): tag is string => Boolean(tag)),
  };
}
