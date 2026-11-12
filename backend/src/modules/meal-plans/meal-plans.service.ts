import type { FoodUnit, PlanStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { filterRecipesForProfile, normalizeFoodText } from "../../services/dietary.service.js";
import { calculateNutritionTargets } from "../../services/nutrition.service.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";
import { foodCategoryOf, withFoodCategory } from "../../services/food-category.js";
import { requiredQuantity } from "../../services/pantry-consumption.js";
import { HttpError } from "../../utils/http-error.js";
import { generatePlanWithAI, getAIStatus } from "../ai/ai.service.js";
import { loadUserInteractions } from "../recommendation/interaction-loader.js";
import { recipeFit, type SafetyProfile } from "../recommendation/safety.js";
import { reconcileAIPlan } from "./meal-plan-generator.js";
import { scoredPlan } from "./meal-plan-scorer.js";
import { planSuggestions, type SuggestionProfile } from "./meal-plan-suggestions.js";

/** Vì sao thực đơn "Tạo bằng AI" phải dùng bộ tạo thuật toán: chưa có key, OpenAI quá 120 giây, OpenAI lỗi, kết quả AI hỏng quá nửa. */
export type PlanFallbackReason = "AI_NOT_CONFIGURED" | "AI_TIMEOUT" | "AI_ERROR" | "AI_INVALID";

/**
 * Tạo thực đơn 7 ngày. Mặc định (useAI = false) dùng bộ tạo thuật toán `scoredPlan` (R8): có kết quả ngay, không gọi OpenAI.
 * useAI = true (chỉ chạy nền qua meal-plan-jobs.ts): gọi OpenAI, kết quả luôn qua reconcileAIPlan; lỗi/hết giờ/hỏng → thuật toán.
 * Trả kèm `generation` (không lưu DB) để giao diện báo đã dùng cách nào và vì sao.
 */
export async function generateWeeklyPlan(userId: string, startDateInput: string, { useAI = false }: { useAI?: boolean } = {}) {
  const [user, pantry, allRecipes, history] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } }),
    // Món đã ẩn không vào danh sách gửi OpenAI lẫn thuật toán dự phòng; AI trả id món ẩn thì reconcileAIPlan coi là ngoài danh sách.
    prisma.recipe.findMany({ where: visibleRecipeWhere, include: { ingredients: true } }),
    // Lịch sử của chính người dùng cho thuật toán 1 và độ đa dạng (bộ tạo không dùng OpenAI, GĐ3b-R8).
    loadUserInteractions(userId),
  ]);
  if (!user) throw new HttpError(404, "Không tìm thấy người dùng.");
  const profile = user.profile;
  const targets = calculateNutritionTargets(profile ?? {});
  // Lọc chung cho cả OpenAI và thuật toán dự phòng: chay/thuần chay bắt buộc, dị ứng theo nhóm, món không thích.
  const recipes = filterRecipesForProfile(allRecipes, profile);
  const dietType = profile?.dietType ?? "BALANCED";
  const pantryNames = new Set(pantry.map((item) => normalizeFoodText(item.name)));
  const mealsPerDay = profile?.mealsPerDay ?? 3;
  const aiContext = {
    nutritionTargets: targets,
    mealsPerDay,
    dietType,
    allergies: profile?.allergies ?? [],
    dislikedFoods: profile?.dislikedFoods ?? [],
    preferredCuisines: profile?.preferredCuisines ?? [],
    pantry: pantry.map(({ name, quantity, unit, expiryDate }) => ({ name, quantity, unit, expiryDate })),
    recipes: recipes.map(({ id, name, calories, proteinG, carbsG, fatG, cuisine, dietTags, mealTypes, ingredients }) => ({
      id, name, calories, proteinG, carbsG, fatG, cuisine, dietTags, mealTypes,
      ingredients: ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    })),
  };

  const startDate = new Date(`${startDateInput}T00:00:00.000Z`);
  let fallbackReason: PlanFallbackReason | null = null;
  let aiPlan: Awaited<ReturnType<typeof generatePlanWithAI>> = null;
  if (useAI && !getAIStatus().available) fallbackReason = "AI_NOT_CONFIGURED";
  else if (useAI) {
    // OpenAI lỗi hoặc quá 120 giây: không báo lỗi, chuyển sang bộ tạo thuật toán và ghi lý do.
    aiPlan = await generatePlanWithAI(aiContext).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Tạo thực đơn bằng OpenAI lỗi, dùng bộ tạo thuật toán:", message);
      fallbackReason = /timed? ?out|timeout|abort/i.test(message) ? "AI_TIMEOUT" : "AI_ERROR";
      return null;
    });
  }
  // Kết quả OpenAI luôn qua reconcileAIPlan (đúng danh sách đã lọc, đúng bữa); không có key, hoặc AI hỏng quá nửa số bữa → bộ
  // tạo chấm điểm (thuật toán 3 + 0,3·thuật toán 1, kho ảo, không lặp trong 3 ngày).
  const reconciled = aiPlan ? reconcileAIPlan(aiPlan, recipes, pantryNames, mealsPerDay, dietType) : null;
  if (useAI && !fallbackReason && (!reconciled || reconciled.source === "fallback")) fallbackReason = "AI_INVALID";
  const { plan: rawPlan, source } = reconciled && reconciled.source !== "fallback"
    ? reconciled
    : { plan: scoredPlan({ recipes, catalog: allRecipes, profile, mealsPerDay, pantry, history, startDate }), source: "fallback" as const };
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const validDays = rawPlan.days
    .filter((day) => day.dayIndex >= 0 && day.dayIndex <= 6)
    .sort((a, b) => a.dayIndex - b.dayIndex);
  if (!validDays.length) throw new HttpError(502, "AI chưa tạo được thực đơn hợp lệ.");

  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  const selectedIngredients: Array<{ name: string; quantity: number; unit: FoodUnit }> = [];
  const days = validDays.map((day) => ({
    date: new Date(startDate.getTime() + day.dayIndex * 86_400_000),
    items: day.meals.flatMap((meal) => {
      const recipe = recipeById.get(meal.recipeId);
      if (!recipe) return [];
      recipe.ingredients.forEach((ingredient) => selectedIngredients.push({
        name: ingredient.name,
        // Định lượng công thức tính cho recipe.servings khẩu phần; bữa ăn meal.servings khẩu phần.
        quantity: requiredQuantity(ingredient.quantity, meal.servings, recipe.servings),
        unit: ingredient.unit,
      }));
      return [{
        recipeId: recipe.id,
        mealType: meal.mealType,
        servings: meal.servings,
        calories: Math.round(recipe.calories * meal.servings),
      }];
    }),
  }));

  const pantryByKey = new Map(pantry.map((item) => [`${normalizeFoodText(item.name)}:${item.unit}`, item.quantity]));
  const required = new Map<string, { name: string; quantity: number; unit: FoodUnit }>();
  for (const item of selectedIngredients) {
    const key = `${normalizeFoodText(item.name)}:${item.unit}`;
    const current = required.get(key);
    required.set(key, { ...item, quantity: (current?.quantity ?? 0) + item.quantity });
  }
  const shoppingItems = [...required.entries()].flatMap(([key, item]) => {
    const missing = item.quantity - (pantryByKey.get(key) ?? 0);
    return missing > 0.01 ? [{ ...item, quantity: Math.round(missing * 10) / 10, category: foodCategoryOf(item.name) }] : [];
  });

  const created = await prisma.mealPlan.create({
    data: {
      userId,
      name: `Thực đơn ${startDate.toLocaleDateString("vi-VN", { timeZone: "UTC" })}`,
      startDate,
      endDate,
      calorieTarget: profile?.dailyCalorieTarget ?? targets.calories,
      aiGenerated: source !== "fallback",
      summary: rawPlan.summary,
      days: { create: days.map((day) => ({ date: day.date, items: { create: day.items } })) },
      shoppingItems: { create: shoppingItems },
    },
    include: planInclude,
  });
  return { ...forReading(created, profile), generation: { mode: useAI ? "ai" as const : "algorithm" as const, fallbackReason } };
}

export const planInclude = {
  days: { orderBy: { date: "asc" as const }, include: { items: { include: { recipe: { include: { ingredients: true } } } } } },
  shoppingItems: { orderBy: [{ purchased: "asc" as const }, { name: "asc" as const }] },
};

type ReadablePlan = {
  shoppingItems: Array<{ name: string; category: string | null }>;
  days: Array<{ items: Array<{ recipe: Parameters<typeof recipeFit>[0] & { fiberG: number; fatG: number } }> }>;
};

/**
 * Dữ liệu trả về khi đọc thực đơn: dòng đi chợ tạo trước GĐ3b lượt 5 chưa có `category` thì tính theo tên (không đổi
 * dữ liệu đã lưu); mỗi món kèm `fit` theo hồ sơ hiện tại (GĐ3b-R2: thực đơn tạo trước khi thêm dị ứng hiện cảnh báo);
 * `suggestions`: gợi ý dinh dưỡng của tuần theo hồ sơ hiện tại.
 */
function forReading<T extends ReadablePlan>(plan: T, profile: SafetyProfile & SuggestionProfile) {
  return {
    suggestions: planSuggestions(plan, profile),
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      items: day.items.map((item) => ({ ...item, recipe: { ...item.recipe, fit: recipeFit(item.recipe, profile) } })),
    })),
    shoppingItems: plan.shoppingItems.map(withFoodCategory),
  };
}

const profileOf = (userId: string) => prisma.nutritionProfile.findUnique({ where: { userId } });

export async function listMealPlans(userId: string) {
  const [plans, profile] = await Promise.all([
    prisma.mealPlan.findMany({
      where: { userId },
      include: planInclude,
      // Mới nhất trước; trùng ngày bắt đầu thì thực đơn tạo sau đứng trước.
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    profileOf(userId),
  ]);
  return plans.map((plan) => forReading(plan, profile));
}

export async function getMealPlan(userId: string, id: string) {
  const [plan, profile] = await Promise.all([prisma.mealPlan.findFirst({ where: { id, userId }, include: planInclude }), profileOf(userId)]);
  if (!plan) throw new HttpError(404, "Không tìm thấy thực đơn.");
  return forReading(plan, profile);
}

export async function updateMealPlanStatus(userId: string, id: string, status: PlanStatus) {
  const plan = await prisma.$transaction(async (transaction) => {
    const result = await transaction.mealPlan.updateMany({ where: { id, userId }, data: { status } });
    if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
    return transaction.mealPlan.findUnique({ where: { id }, include: planInclude });
  });
  return plan && forReading(plan, await profileOf(userId));
}

export async function deleteMealPlan(userId: string, id: string) {
  const result = await prisma.mealPlan.deleteMany({ where: { id, userId } });
  if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
}
