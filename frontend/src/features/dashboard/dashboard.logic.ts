import { differenceInCalendarDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import { Moon, Sun, Sunrise } from "lucide-react";
import type { DashboardData, DashboardRecommendedRecipe, MealType } from "../../types";
import { IMAGE_WIDTHS, optimizedImageUrl } from "../../utils/images";
import { recipeDetailPath } from "../recipes/recipes.logic";

export const dashboardMealLabels: Record<MealType, string> = {
  BREAKFAST: "Sáng",
  LUNCH: "Trưa",
  DINNER: "Tối",
  SNACK: "Bữa phụ",
};

export const dashboardMealTimes: Record<MealType, string> = {
  BREAKFAST: "08:00",
  LUNCH: "12:30",
  DINNER: "19:00",
  SNACK: "15:30",
};

export const dashboardFallbackRecipes: DashboardData["recommendedRecipes"] = [
  { id: "fallback-ga-xao-sa-ot", name: "Gà xào sả ớt (kèm cơm)", calories: 600, prepMinutes: 15, cookMinutes: 15, dietTags: ["BALANCED", "HIGH_PROTEIN"] },
  { id: "fallback-ga-teriyaki", name: "Gà teriyaki (kèm cơm)", calories: 620, prepMinutes: 10, cookMinutes: 20, dietTags: ["BALANCED", "HIGH_PROTEIN"] },
  { id: "fallback-bo-xao-bong-cai", name: "Bò xào bông cải", calories: 360, prepMinutes: 15, cookMinutes: 10, dietTags: ["LOW_CARB", "HIGH_PROTEIN"] },
];

export const dashboardSuggestionImages = [
  "/assets/dashboard-recipe-chicken-quinoa-v4.jpg",
  "/assets/dashboard-recipe-chicken-pesto-v4.jpg",
  "/assets/dashboard-recipe-chicken-salad-v4.jpg",
];

export function dashboardMealImage(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("yến mạch") || normalized.includes("sữa chua") || normalized.includes("chuối")) return "/assets/recipe-oats.jpg";
  if (normalized.includes("cá") || normalized.includes("tôm") || normalized.includes("ngừ")) return "/assets/recipe-salmon.jpg";
  if (normalized.includes("đậu") || normalized.includes("rau") || normalized.includes("nấm") || normalized.includes("bowl")) return "/assets/recipe-vegan-bowl.jpg";
  return "/assets/nutrition-hero.jpg";
}

export function dashboardMealIcon(mealType: MealType) {
  if (mealType === "BREAKFAST") return Sunrise;
  if (mealType === "DINNER") return Moon;
  return Sun;
}

export function dashboardRecipeSearchPath(search: string) {
  const normalized = search.trim();
  return normalized ? `/recipes?q=${encodeURIComponent(normalized)}` : null;
}

export function dashboardWaterLiters(waterGlasses: number) {
  return Number((waterGlasses * 0.25).toFixed(2));
}

export const DASHBOARD_MAX_WATER_GLASSES = 8;

export function nextWaterGlasses(waterGlasses: number) {
  return Math.min(DASHBOARD_MAX_WATER_GLASSES, waterGlasses + 1);
}

/** Ngày hiển thị ở đầu Dashboard, vd. "Thứ Sáu, 30 tháng 10". */
export function dashboardDateLabel(now = new Date()) {
  return { iso: format(now, "yyyy-MM-dd"), label: format(now, "EEEE, dd 'tháng' M", { locale: vi }) };
}

/** Công thức mẫu dự phòng không có trong DB nên chỉ dẫn về danh sách công thức. */
export function recommendedRecipePath(recipeId: string, isRealRecipe: boolean) {
  return isRealRecipe ? recipeDetailPath(recipeId) : "/recipes";
}

/** Ảnh công thức (imageUrl) nếu có; món mẫu dự phòng dùng ảnh gợi ý cố định, rồi ảnh theo tên. */
export function recommendedRecipeImage(index: number, recipe: Pick<DashboardRecommendedRecipe, "name" | "imageUrl">) {
  return recipe.imageUrl ? optimizedImageUrl(recipe.imageUrl, IMAGE_WIDTHS.card) : (dashboardSuggestionImages[index] ?? dashboardMealImage(recipe.name));
}

/** Dòng phụ dưới tên món gợi ý: ưu tiên nguyên liệu sắp hết hạn, rồi nguyên liệu trong kho; không dùng gì trong kho thì ẩn. */
export function recommendedRecipePantryNote(recipe: Pick<DashboardRecommendedRecipe, "pantryIngredientCount" | "expiringIngredientCount">) {
  if (recipe.expiringIngredientCount) return `Dùng ${recipe.expiringIngredientCount} nguyên liệu sắp hết hạn`;
  if (recipe.pantryIngredientCount) return `Dùng ${recipe.pantryIngredientCount} nguyên liệu trong kho`;
  return null;
}

export function dashboardInsightMessage(hasExpiringItems: boolean) {
  return hasExpiringItems
    ? "sắp hết hạn. Nouri gợi ý món ngon sử dụng cả hai để tránh lãng phí nhé."
    : "Hãy tiếp tục duy trì thói quen sử dụng nguyên liệu tươi và lên kế hoạch bữa ăn đều đặn.";
}

export function buildDashboardViewModel(
  data: DashboardData | undefined,
  userName: string | undefined,
  now = new Date(),
) {
  const todayMeals = data?.todayMeals ?? [];
  // Công thức mẫu dự phòng không có trong DB nên không được liên kết tới trang chi tiết.
  const hasRealRecommendedRecipes = Boolean(data?.recommendedRecipes?.length);
  const recommendedRecipes = hasRealRecommendedRecipes
    ? data!.recommendedRecipes.slice(0, 3)
    : dashboardFallbackRecipes;
  const expiringItems = data?.expiringItems ?? [];
  const hour = now.getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const firstName = userName?.split(" ").at(-1) ?? "bạn";
  const calorieTarget = data?.nutritionTargets?.calories ?? 2000;
  const consumedCalories = todayMeals
    .filter((meal) => meal.completed)
    .reduce((sum, meal) => sum + meal.calories, 0);
  const calorieProgress = Math.min(100, Math.round((consumedCalories / Math.max(1, calorieTarget)) * 100));
  const completedMeals = todayMeals.filter((meal) => meal.completed).length;
  const mealProgress = todayMeals.length ? Math.round((completedMeals / todayMeals.length) * 100) : 0;
  const insightItems = expiringItems.slice(0, 2);
  const insightTitle = insightItems.length
    ? insightItems
      .map((item) => `${item.name} (${Math.max(0, differenceInCalendarDays(new Date(item.expiryDate!), now))} ngày)`)
      .join(" và ")
    : "Kho thực phẩm của bạn đang được cân bằng tốt";

  return {
    todayMeals,
    recommendedRecipes,
    hasRealRecommendedRecipes,
    expiringItems,
    greeting,
    firstName,
    calorieTarget,
    consumedCalories,
    calorieProgress,
    completedMeals,
    mealProgress,
    insightItems,
    insightTitle,
  };
}
