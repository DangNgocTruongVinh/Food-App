import type { MealPlan, MealPlanItem, MealType, NutritionProfile } from "../../types";
import { recipeImageSrc } from "../recipes/recipes.logic";

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

// Ảnh của chính công thức (imageUrl, hoặc ảnh tạm theo tên món), không chọn theo bữa.
export function mealItemImage(item: Pick<MealPlanItem, "recipe">) {
  return recipeImageSrc(item.recipe);
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

export function mealPlanPath(id?: string | null) {
  return id ? `/meal-plans/${encodeURIComponent(id)}` : "/meal-plans";
}

type PlanOrderFields = Pick<MealPlan, "id" | "startDate" | "createdAt">;

// Mới nhất theo ngày bắt đầu; trùng ngày thì thực đơn tạo sau (createdAt) đứng trước.
function compareNewestFirst(a: PlanOrderFields, b: PlanOrderFields) {
  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
}

/** Thực đơn mở khi vào /meal-plans không kèm id. */
export function latestMealPlanId(plans: PlanOrderFields[], excludeId?: string) {
  return [...plans].filter((plan) => plan.id !== excludeId).sort(compareNewestFirst)[0]?.id ?? null;
}

export function nextMealPlanIdAfterDelete(plans: PlanOrderFields[], deletedId: string) {
  return latestMealPlanId(plans, deletedId);
}

export function mealPlanDeleteConfirmMessage(plan: Pick<MealPlan, "name" | "status">) {
  const activeWarning = plan.status === "ACTIVE" ? " Thực đơn này đang được áp dụng." : "";
  return `Xóa thực đơn “${plan.name}”?${activeWarning} Toàn bộ bữa ăn và danh sách mua sắm của thực đơn sẽ bị xóa và không thể khôi phục.`;
}

export type MealPlanSuggestion = { key: string; image: string; alt: string; text: string };
type SuggestionCandidate = MealPlanSuggestion & { excludedDiets?: string[]; conflicts?: string[] };

const asWords = (value: string) => ` ${value.trim().toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

// Gợi ý không được mâu thuẫn với chế độ ăn, dị ứng hoặc món không thích (vd. "cá hồi" ↔ "cá", "Hải sản").
function conflictsWithProfile(candidate: SuggestionCandidate, profile: NutritionProfile | null | undefined) {
  if (!profile) return false;
  if (candidate.excludedDiets?.includes(profile.dietType)) return true;
  const restrictions = [...(profile.allergies ?? []), ...(profile.dislikedFoods ?? [])].map(asWords).filter((item) => item.trim());
  return (candidate.conflicts ?? []).map(asWords).some((term) => restrictions.some((item) => item.includes(term) || term.includes(item)));
}

const fatCandidates: SuggestionCandidate[] = [
  {
    key: "omega3-fish", image: "/assets/recipe-salmon.jpg", alt: "Cá hồi",
    text: "Bổ sung cá béo như cá hồi, cá thu giúp đa dạng nguồn Omega-3 trong tuần.",
    excludedDiets: ["VEGETARIAN", "VEGAN"], conflicts: ["hải sản", "thủy sản", "đồ biển", "seafood", "cá"],
  },
  {
    key: "omega3-plant", image: "/assets/recipe-vegan-bowl.jpg", alt: "Món chay từ đậu",
    text: "Bổ sung Omega-3 từ thực vật như đậu nành, đậu hũ hoặc hạt óc chó.",
    conflicts: ["đậu nành", "đậu hũ", "óc chó", "các loại hạt"],
  },
  {
    key: "fat-plant-oil", image: "/assets/recipe-vegan-bowl.jpg", alt: "Rau củ",
    text: "Ưu tiên dầu thực vật khi nấu và giữ lượng chất béo vừa phải trong tuần.",
  },
];

/** Hai gợi ý ở trang Thực đơn: chất xơ và chất béo, đã loại các gợi ý mâu thuẫn với hồ sơ. */
export function mealPlanSuggestions(
  profile: NutritionProfile | null | undefined,
  averages: { fiber: number; fat: number },
  targets: { fiber: number; fat: number },
): MealPlanSuggestion[] {
  const fiber: MealPlanSuggestion = {
    key: "fiber", image: "/assets/recipe-vegan-bowl.jpg", alt: "Rau xanh",
    text: averages.fiber < targets.fiber
      ? "Thêm 1–2 khẩu phần rau xanh mỗi ngày để cân bằng dinh dưỡng."
      : "Lượng chất xơ tuần này đang ở mức cân bằng tốt.",
  };
  const fat: MealPlanSuggestion = averages.fat > targets.fat
    ? { key: "fat-reduce", image: "/assets/recipe-vegan-bowl.jpg", alt: "Rau củ", text: "Ưu tiên chất béo tốt và giảm các món chiên trong những ngày tới." }
    : fatCandidates.find((candidate) => !conflictsWithProfile(candidate, profile))!;
  return [fiber, fat].map(({ key, image, alt, text }) => ({ key, image, alt, text }));
}
