import type { FoodUnit, PlanStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { filterRecipesForProfile, normalizeFoodText } from "../../services/dietary.service.js";
import { calculateNutritionTargets } from "../../services/nutrition.service.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";
import { foodCategoryOf, withFoodCategory } from "../../services/food-category.js";
import { requiredQuantity } from "../../services/pantry-consumption.js";
import { HttpError } from "../../utils/http-error.js";
import { generatePlanWithAI } from "../ai/ai.service.js";
import { fallbackPlan, reconcileAIPlan } from "./meal-plan-generator.js";

export async function generateWeeklyPlan(userId: string, startDateInput: string) {
  const [user, pantry, allRecipes] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } }),
    // Món đã ẩn không vào danh sách gửi OpenAI lẫn thuật toán dự phòng; AI trả id món ẩn thì reconcileAIPlan coi là ngoài danh sách.
    prisma.recipe.findMany({ where: visibleRecipeWhere, include: { ingredients: true } }),
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

  const aiPlan = await generatePlanWithAI(aiContext);
  const { plan: rawPlan, source } = aiPlan
    ? reconcileAIPlan(aiPlan, recipes, pantryNames, mealsPerDay, dietType)
    : { plan: fallbackPlan(recipes, pantryNames, mealsPerDay, dietType), source: "fallback" as const };
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const validDays = rawPlan.days
    .filter((day) => day.dayIndex >= 0 && day.dayIndex <= 6)
    .sort((a, b) => a.dayIndex - b.dayIndex);
  if (!validDays.length) throw new HttpError(502, "AI chưa tạo được thực đơn hợp lệ.");

  const startDate = new Date(`${startDateInput}T00:00:00.000Z`);
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
  return withShoppingCategories(created);
}

export const planInclude = {
  days: { orderBy: { date: "asc" as const }, include: { items: { include: { recipe: { include: { ingredients: true } } } } } },
  shoppingItems: { orderBy: [{ purchased: "asc" as const }, { name: "asc" as const }] },
};

/** Dòng đi chợ tạo trước GĐ3b lượt 5 chưa có `category`: tính theo tên khi đọc (không đổi dữ liệu đã lưu). */
function withShoppingCategories<T extends { shoppingItems: Array<{ name: string; category: string | null }> }>(plan: T) {
  return { ...plan, shoppingItems: plan.shoppingItems.map(withFoodCategory) };
}

export async function listMealPlans(userId: string) {
  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    include: planInclude,
    // Mới nhất trước; trùng ngày bắt đầu thì thực đơn tạo sau đứng trước.
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
  return plans.map(withShoppingCategories);
}

export async function getMealPlan(userId: string, id: string) {
  const plan = await prisma.mealPlan.findFirst({ where: { id, userId }, include: planInclude });
  if (!plan) throw new HttpError(404, "Không tìm thấy thực đơn.");
  return withShoppingCategories(plan);
}

export async function updateMealPlanStatus(userId: string, id: string, status: PlanStatus) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.mealPlan.updateMany({ where: { id, userId }, data: { status } });
    if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
    const plan = await transaction.mealPlan.findUnique({ where: { id }, include: planInclude });
    return plan && withShoppingCategories(plan);
  });
}

export async function updateShoppingPurchased(userId: string, id: string, purchased: boolean) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.shoppingItem.updateMany({
      where: { id, mealPlan: { userId } },
      data: { purchased },
    });
    if (!result.count) throw new HttpError(404, "Không tìm thấy nguyên liệu mua sắm.");
    const item = await transaction.shoppingItem.findUnique({ where: { id } });
    if (!item) throw new HttpError(404, "Không tìm thấy nguyên liệu mua sắm.");
    return withFoodCategory(item);
  });
}

export async function deleteMealPlan(userId: string, id: string) {
  const result = await prisma.mealPlan.deleteMany({ where: { id, userId } });
  if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
}
