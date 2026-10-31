import { differenceInCalendarDays } from "date-fns";
import type { DashboardData, DashboardRecommendedRecipe, MealPlanItem, MealType } from "../../types";

// Logic thuần của trang Tổng quan (UI-3): chỉ dùng dữ liệu thật của dashboard API và chi tiết thực đơn đang dùng.

export type TodayMeal = DashboardData["todayMeals"][number];
type Targets = NonNullable<DashboardData["nutritionTargets"]>;

export const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];

export const dashboardMealLabels: Record<MealType, string> = {
  BREAKFAST: "Bữa sáng",
  LUNCH: "Bữa trưa",
  SNACK: "Bữa phụ",
  DINNER: "Bữa tối",
};

/** Các bữa hôm nay theo thứ tự trong ngày (sáng, trưa, phụ, tối). */
export function orderTodayMeals(meals: TodayMeal[]) {
  return [...meals].sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType));
}

/** Bữa kế tiếp = bữa đầu tiên (theo thứ tự trong ngày) chưa đánh dấu đã ăn. */
export function nextMealId(meals: TodayMeal[]) {
  return orderTodayMeals(meals).find((meal) => !meal.completed)?.id ?? null;
}

export function percentOf(value: number, target: number) {
  return target > 0 ? Math.round((value / target) * 100) : 0;
}

export type NutrientProgress = { consumed: number; target: number; percent: number };

/**
 * Dinh dưỡng đã ăn hôm nay. Calo lấy từ các bữa đã đánh dấu (dashboard API); đạm/tinh bột/béo lấy từ công thức của
 * bữa đó trong chi tiết thực đơn (× khẩu phần). planItems chưa tải → macros = null.
 */
export function buildNutritionSummary(meals: TodayMeal[], targets: Targets, planItems?: MealPlanItem[]) {
  const eaten = meals.filter((meal) => meal.completed);
  const consumedCalories = eaten.reduce((sum, meal) => sum + meal.calories, 0);
  const plannedCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
  const progress = (consumed: number, target: number): NutrientProgress => ({ consumed: Math.round(consumed), target, percent: percentOf(consumed, target) });

  let macros: { protein: NutrientProgress; carbs: NutrientProgress; fat: NutrientProgress } | null = null;
  if (planItems) {
    const byId = new Map(planItems.map((item) => [item.id, item]));
    const sum = (pick: (item: MealPlanItem) => number) => eaten.reduce((total, meal) => {
      const item = byId.get(meal.id);
      return total + (item ? pick(item) * (item.servings || 1) : 0);
    }, 0);
    macros = {
      protein: progress(sum((item) => item.recipe.proteinG), targets.proteinG),
      carbs: progress(sum((item) => item.recipe.carbsG), targets.carbsG),
      fat: progress(sum((item) => item.recipe.fatG), targets.fatG),
    };
  }
  return {
    calories: progress(consumedCalories, targets.calories),
    plannedCalories,
    /** Còn lại so với mục tiêu nếu ăn hết các bữa hôm nay (âm = vượt). */
    remainingAfterPlan: targets.calories - plannedCalories,
    macros,
  };
}

/** Mục tiêu dinh dưỡng dùng được (hồ sơ đã có và đã tính chỉ tiêu). */
export function usableTargets(targets: DashboardData["nutritionTargets"]): Targets | null {
  if (!targets || !targets.calories) return null;
  return { calories: targets.calories, proteinG: targets.proteinG ?? 0, carbsG: targets.carbsG ?? 0, fatG: targets.fatG ?? 0 };
}

/** Vòng calo: độ dài nét theo phần trăm (tối đa đủ vòng khi vượt mục tiêu). */
export function ringDash(percent: number, radius: number) {
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return { circumference, offset: circumference - filled };
}

/** Số ngày còn lại tới hạn sử dụng (âm = đã hết hạn). */
export function daysLeft(expiryDate: string | null, now = new Date()) {
  return expiryDate ? differenceInCalendarDays(new Date(expiryDate), now) : null;
}

export function daysLeftLabel(days: number | null) {
  if (days === null) return "Chưa có hạn sử dụng";
  if (days < 0) return "Đã hết hạn";
  if (days === 0) return "Hết hạn hôm nay";
  return `Còn ${days} ngày`;
}

/** API trả tối đa 5 món sắp hết hạn (7 ngày tới): đủ 5 thì ghi "5+" để không hiểu nhầm là đúng 5. */
export const EXPIRING_LIST_LIMIT = 5;
export function expiringCountLabel(count: number) {
  return count >= EXPIRING_LIST_LIMIT ? `${EXPIRING_LIST_LIMIT}+` : String(count);
}

/** Lý do gợi ý món ở đầu trang, dựa trên dữ liệu thật của món. */
export function recommendationReason(recipe: Pick<DashboardRecommendedRecipe, "pantryIngredientCount" | "expiringIngredientCount">, hasProfile: boolean) {
  if (recipe.expiringIngredientCount) return `Dùng ${recipe.expiringIngredientCount} nguyên liệu sắp hết hạn trong tủ bếp của bạn.`;
  if (recipe.pantryIngredientCount) return `Dùng ${recipe.pantryIngredientCount} nguyên liệu bạn đang có trong tủ bếp.`;
  if (hasProfile) return "Hợp với chế độ ăn, dị ứng và món không thích trong hồ sơ của bạn.";
  return null;
}

/** Dòng phụ dưới tên món gợi ý: ưu tiên nguyên liệu sắp hết hạn, rồi nguyên liệu trong kho; không dùng gì trong kho thì ẩn. */
export function recommendedRecipePantryNote(recipe: Pick<DashboardRecommendedRecipe, "pantryIngredientCount" | "expiringIngredientCount">) {
  if (recipe.expiringIngredientCount) return `Dùng ${recipe.expiringIngredientCount} nguyên liệu sắp hết hạn`;
  if (recipe.pantryIngredientCount) return `Dùng ${recipe.pantryIngredientCount} nguyên liệu trong kho`;
  return null;
}

export function dashboardRecipeSearchPath(search: string) {
  const normalized = search.trim();
  return normalized ? `/recipes?q=${encodeURIComponent(normalized)}` : null;
}

export const formatNumber = (value: number) => value.toLocaleString("vi-VN");

// Lượng nước: chỉ ghi nhận trong phiên (chưa lưu DB, xem GĐ5). Mỗi ly 250 ml, tối đa 8 ly.
export const DASHBOARD_MAX_WATER_GLASSES = 8;

export function dashboardWaterLiters(waterGlasses: number) {
  return Number((waterGlasses * 0.25).toFixed(2));
}

export function nextWaterGlasses(waterGlasses: number) {
  return Math.min(DASHBOARD_MAX_WATER_GLASSES, waterGlasses + 1);
}
