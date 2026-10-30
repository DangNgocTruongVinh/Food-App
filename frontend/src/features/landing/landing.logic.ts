import type { RecipeStats } from "../../types";

/** Nhóm công thức ở Landing, khớp nhãn thật của công thức (bữa ăn/chế độ ăn) và khóa số đếm từ GET /api/recipes/stats. */
export const landingRecipeCategoryStats = {
  all: "total",
  breakfast: "breakfast",
  vegetarian: "vegetarian",
  vegan: "vegan",
  "low-carb": "lowCarb",
  protein: "highProtein",
} as const satisfies Record<string, keyof RecipeStats>;

export type LandingRecipeCategoryId = keyof typeof landingRecipeCategoryStats;

/** "33 món" khi đã có số thật; chưa tải được thì ẩn số (không hiện số giả). */
export function landingCategoryCountLabel(stats: RecipeStats | undefined, categoryId: LandingRecipeCategoryId) {
  const count = stats?.[landingRecipeCategoryStats[categoryId]];
  return typeof count === "number" ? `${count} món` : null;
}
