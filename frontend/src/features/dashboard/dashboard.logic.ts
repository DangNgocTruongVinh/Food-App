import { differenceInCalendarDays } from "date-fns";
import { Moon, Sun, Sunrise } from "lucide-react";
import type { DashboardData, MealType } from "../../types";

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
