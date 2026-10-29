import type { DietType, FoodUnit, MealType, PlanStatus, Recipe } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { filterRecipesForProfile, prefersDiet } from "../../services/dietary.service.js";
import { calculateNutritionTargets } from "../../services/nutrition.service.js";
import { HttpError } from "../../utils/http-error.js";
import { generatePlanWithAI, type GeneratedPlan } from "../ai/ai.service.js";

type RecipeWithIngredients = Recipe & { ingredients: Array<{ name: string; quantity: number; unit: FoodUnit }> };

const normalize = (value: string) => value.trim().toLocaleLowerCase("vi");

/** Các bữa trong ngày theo hồ sơ (profile cho phép 3–4 bữa). */
export function mealSlots(mealsPerDay: number): MealType[] {
  return mealsPerDay >= 4 ? ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] : ["BREAKFAST", "LUNCH", "DINNER"];
}

export function fallbackPlan(
  recipes: RecipeWithIngredients[],
  pantryNames: Set<string>,
  mealsPerDay: number,
  dietType: DietType = "BALANCED",
): GeneratedPlan {
  // Điểm = số nguyên liệu đã có trong kho, cộng thêm khi món hợp chế độ ăn được ưu tiên (LOW_CARB/HIGH_PROTEIN).
  const ranked = recipes
    .map((recipe) => ({
      recipe,
      score: recipe.ingredients.filter((ingredient) => pantryNames.has(normalize(ingredient.name))).length
        + (prefersDiet(recipe, dietType) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.recipe.calories - b.recipe.calories)
    .map(({ recipe }) => recipe);
  if (!ranked.length) throw new HttpError(422, "Chưa có công thức phù hợp để tạo thực đơn.");

  // Món chưa khai báo bữa (mealTypes rỗng) vẫn được dùng khi một bữa không có món riêng.
  const candidatesFor = (mealType: MealType) => {
    const fit = ranked.filter((recipe) => recipe.mealTypes?.includes(mealType));
    return fit.length ? fit : ranked;
  };

  return {
    summary: "Thực đơn được tạo bằng thuật toán ưu tiên thực phẩm sẵn có, đúng bữa và phù hợp chế độ ăn.",
    days: Array.from({ length: 7 }, (_, dayIndex) => {
      const usedToday = new Set<string>();
      return {
        dayIndex,
        meals: mealSlots(mealsPerDay).map((mealType) => {
          const candidates = candidatesFor(mealType);
          // Xoay vòng theo ngày để đa dạng; tránh lặp một món trong cùng ngày nếu còn lựa chọn khác.
          const recipe = Array.from({ length: candidates.length }, (_, offset) => candidates[(dayIndex + offset) % candidates.length])
            .find((item) => !usedToday.has(item.id)) ?? candidates[dayIndex % candidates.length];
          usedToday.add(recipe.id);
          return { mealType, recipeId: recipe.id, servings: 1, reason: "Phù hợp bữa ăn, kho thực phẩm và mục tiêu năng lượng." };
        }),
      };
    }),
  };
}

export async function generateWeeklyPlan(userId: string, startDateInput: string) {
  const [user, pantry, allRecipes] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } }, orderBy: { expiryDate: "asc" } }),
    prisma.recipe.findMany({ include: { ingredients: true } }),
  ]);
  if (!user) throw new HttpError(404, "Không tìm thấy người dùng.");
  const profile = user.profile;
  const targets = calculateNutritionTargets(profile ?? {});
  // Lọc chung cho cả OpenAI và thuật toán dự phòng: chay/thuần chay bắt buộc, dị ứng theo nhóm, món không thích.
  const recipes = filterRecipesForProfile(allRecipes, profile);
  const dietType = profile?.dietType ?? "BALANCED";
  const pantryNames = new Set(pantry.map((item) => normalize(item.name)));
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

  const rawPlan = (await generatePlanWithAI(aiContext)) ?? fallbackPlan(recipes, pantryNames, mealsPerDay, dietType);
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
        quantity: ingredient.quantity * meal.servings,
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

  const pantryByKey = new Map(pantry.map((item) => [`${normalize(item.name)}:${item.unit}`, item.quantity]));
  const required = new Map<string, { name: string; quantity: number; unit: FoodUnit }>();
  for (const item of selectedIngredients) {
    const key = `${normalize(item.name)}:${item.unit}`;
    const current = required.get(key);
    required.set(key, { ...item, quantity: (current?.quantity ?? 0) + item.quantity });
  }
  const shoppingItems = [...required.entries()].flatMap(([key, item]) => {
    const missing = item.quantity - (pantryByKey.get(key) ?? 0);
    return missing > 0.01 ? [{ ...item, quantity: Math.round(missing * 10) / 10 }] : [];
  });

  return prisma.mealPlan.create({
    data: {
      userId,
      name: `Thực đơn ${startDate.toLocaleDateString("vi-VN", { timeZone: "UTC" })}`,
      startDate,
      endDate,
      calorieTarget: profile?.dailyCalorieTarget ?? targets.calories,
      aiGenerated: Boolean(envHasAI()),
      summary: rawPlan.summary,
      days: { create: days.map((day) => ({ date: day.date, items: { create: day.items } })) },
      shoppingItems: { create: shoppingItems },
    },
    include: planInclude,
  });
}

function envHasAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export const planInclude = {
  days: { orderBy: { date: "asc" as const }, include: { items: { include: { recipe: { include: { ingredients: true } } } } } },
  shoppingItems: { orderBy: [{ purchased: "asc" as const }, { name: "asc" as const }] },
};

export function listMealPlans(userId: string) {
  return prisma.mealPlan.findMany({
    where: { userId },
    include: planInclude,
    orderBy: { startDate: "desc" },
  });
}

export async function getMealPlan(userId: string, id: string) {
  const plan = await prisma.mealPlan.findFirst({ where: { id, userId }, include: planInclude });
  if (!plan) throw new HttpError(404, "Không tìm thấy thực đơn.");
  return plan;
}

export async function updateMealPlanStatus(userId: string, id: string, status: PlanStatus) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.mealPlan.updateMany({ where: { id, userId }, data: { status } });
    if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
    return transaction.mealPlan.findUnique({ where: { id }, include: planInclude });
  });
}

export async function updateMealCompletion(userId: string, id: string, completed: boolean) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.mealPlanItem.updateMany({
      where: { id, day: { mealPlan: { userId } } },
      data: { completed },
    });
    if (!result.count) throw new HttpError(404, "Không tìm thấy bữa ăn.");
    const item = await transaction.mealPlanItem.findUnique({ where: { id } });
    if (!item) throw new HttpError(404, "Không tìm thấy bữa ăn.");
    return item;
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
    return item;
  });
}

export async function deleteMealPlan(userId: string, id: string) {
  const result = await prisma.mealPlan.deleteMany({ where: { id, userId } });
  if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
}
