import type { MealPlan, MealPlanItem, MealType, NutritionProfile } from "../../types";

export const mealLabels: Record<MealType, string> = {
  BREAKFAST: "Bữa sáng", LUNCH: "Bữa trưa", DINNER: "Bữa tối", SNACK: "Bữa phụ",
};
export const mealShortLabels: Record<MealType, string> = {
  BREAKFAST: "Sáng", LUNCH: "Trưa", DINNER: "Tối", SNACK: "Bữa phụ",
};
export const mealTimes: Record<MealType, string> = {
  BREAKFAST: "07:00 – 09:00", LUNCH: "11:30 – 13:30", DINNER: "18:00 – 19:30", SNACK: "15:00 – 16:00",
};
export const featuredMealTypes: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];

const recipeImages = ["/assets/recipe-oats.jpg", "/assets/recipe-vegan-bowl.jpg", "/assets/recipe-salmon.jpg"];

export function mealImage(type: MealType, index = 0) {
  const base = type === "BREAKFAST" ? 0 : type === "LUNCH" ? 1 : type === "DINNER" ? 2 : 0;
  return recipeImages[(base + index) % recipeImages.length];
}

export function mealTag(item: MealPlanItem) {
  if (item.recipe.dietTags[0]) return item.recipe.dietTags[0].replaceAll("_", " ");
  if (item.recipe.proteinG >= 25) return "Giàu protein";
  if (item.recipe.fatG <= 15) return "Ít chất béo";
  return "Cân bằng";
}

export function percentage(value: number, target: number) {
  return Math.min(100, Math.round(value / Math.max(target, 1) * 100));
}

export function selectMealPlan(plans: MealPlan[], selectedId: string) {
  return plans.find((plan) => plan.id === selectedId) ?? plans[0];
}

export function selectMealPlanDay(plan: MealPlan | undefined, selectedDayIndex: number) {
  return plan?.days[selectedDayIndex] ?? plan?.days[0];
}

export function summarizeMealPlan(plan: MealPlan | undefined) {
  const planMeals = plan?.days.flatMap((day) => day.items) ?? [];
  const completedMeals = planMeals.filter((item) => item.completed).length;
  const purchasedItems = plan?.shoppingItems.filter((item) => item.purchased).length ?? 0;
  const dayCount = Math.max(plan?.days.length ?? 0, 1);
  const nutrition = planMeals.reduce((totals, item) => ({
    calories: totals.calories + item.calories,
    protein: totals.protein + item.recipe.proteinG,
    carbs: totals.carbs + item.recipe.carbsG,
    fat: totals.fat + item.recipe.fatG,
    fiber: totals.fiber + item.recipe.fiberG,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const averages = {
    calories: Math.round(nutrition.calories / dayCount),
    protein: Math.round(nutrition.protein / dayCount),
    carbs: Math.round(nutrition.carbs / dayCount),
    fat: Math.round(nutrition.fat / dayCount),
    fiber: Math.round(nutrition.fiber / dayCount),
  };
  return {
    planMeals,
    completedMeals,
    purchasedItems,
    nutrition,
    averages,
    completionRate: Math.round(completedMeals / Math.max(planMeals.length, 1) * 100),
  };
}

export function mealPlanTargets(profile: NutritionProfile | null | undefined, plan: MealPlan | undefined) {
  return {
    calories: profile?.dailyCalorieTarget ?? plan?.calorieTarget ?? 2000,
    protein: profile?.proteinTargetG ?? 80,
    carbs: profile?.carbTargetG ?? 250,
    fat: profile?.fatTargetG ?? 65,
    fiber: 30,
  };
}

export function hasBalancedCalories(averageCalories: number, targetCalories: number) {
  return Math.abs(averageCalories - targetCalories) <= targetCalories * .15;
}

export function alternativeMeals(plan: MealPlan, mealType: MealType, primaryId?: string) {
  return plan.days.flatMap((day) => day.items)
    .filter((item) => item.mealType === mealType && item.id !== primaryId)
    .slice(0, 2);
}

export function recipeSearchPath(search: string) {
  const normalized = search.trim();
  return `/recipes${normalized ? `?q=${encodeURIComponent(normalized)}` : ""}`;
}
