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

// Điểm = số nguyên liệu đã có trong kho, cộng thêm khi món hợp chế độ ăn được ưu tiên (LOW_CARB/HIGH_PROTEIN).
function rankRecipes(recipes: RecipeWithIngredients[], pantryNames: Set<string>, dietType: DietType) {
  return recipes
    .map((recipe) => ({
      recipe,
      score: recipe.ingredients.filter((ingredient) => pantryNames.has(normalize(ingredient.name))).length
        + (prefersDiet(recipe, dietType) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.recipe.calories - b.recipe.calories)
    .map(({ recipe }) => recipe);
}

// Món chưa khai báo bữa (mealTypes rỗng) dùng được cho mọi bữa.
function fitsMeal(recipe: RecipeWithIngredients, mealType: MealType) {
  return !recipe.mealTypes?.length || recipe.mealTypes.includes(mealType);
}

// Xoay vòng theo ngày để đa dạng; tránh lặp một món trong cùng ngày nếu còn lựa chọn khác.
function pickRecipeForMeal(ranked: RecipeWithIngredients[], mealType: MealType, dayIndex: number, usedToday: Set<string>) {
  const declared = ranked.filter((recipe) => recipe.mealTypes?.includes(mealType));
  const candidates = declared.length ? declared : ranked;
  return Array.from({ length: candidates.length }, (_, offset) => candidates[(dayIndex + offset) % candidates.length])
    .find((recipe) => !usedToday.has(recipe.id)) ?? candidates[dayIndex % candidates.length];
}

const fallbackReason = "Phù hợp bữa ăn, kho thực phẩm và mục tiêu năng lượng.";

export function fallbackPlan(
  recipes: RecipeWithIngredients[],
  pantryNames: Set<string>,
  mealsPerDay: number,
  dietType: DietType = "BALANCED",
): GeneratedPlan {
  const ranked = rankRecipes(recipes, pantryNames, dietType);
  if (!ranked.length) throw new HttpError(422, "Chưa có công thức phù hợp để tạo thực đơn.");
  return {
    summary: "Thực đơn được tạo bằng thuật toán ưu tiên thực phẩm sẵn có, đúng bữa và phù hợp chế độ ăn.",
    days: Array.from({ length: 7 }, (_, dayIndex) => {
      const usedToday = new Set<string>();
      return {
        dayIndex,
        meals: mealSlots(mealsPerDay).map((mealType) => {
          const recipe = pickRecipeForMeal(ranked, mealType, dayIndex, usedToday);
          usedToday.add(recipe.id);
          return { mealType, recipeId: recipe.id, servings: 1, reason: fallbackReason };
        }),
      };
    }),
  };
}

/** Quá nửa số bữa AI trả về không dùng được thì coi là lỗi nặng và dùng fallbackPlan cho cả thực đơn. */
const MAX_INVALID_AI_MEAL_RATIO = 0.5;

/**
 * Kiểm tra thực đơn OpenAI trả về: mỗi bữa phải dùng món trong danh sách đã lọc (chế độ ăn, dị ứng, món không thích)
 * và đúng bữa theo mealTypes. Bữa vi phạm hoặc bị thiếu được thay bằng món chọn theo logic fallback.
 */
export function reconcileAIPlan(
  aiPlan: GeneratedPlan,
  recipes: RecipeWithIngredients[],
  pantryNames: Set<string>,
  mealsPerDay: number,
  dietType: DietType = "BALANCED",
): { plan: GeneratedPlan; source: "ai" | "ai-corrected" | "fallback"; replacedMeals: number } {
  const fallback = () => ({ plan: fallbackPlan(recipes, pantryNames, mealsPerDay, dietType), source: "fallback" as const });
  const ranked = rankRecipes(recipes, pantryNames, dietType);
  const allowed = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const slots = mealSlots(mealsPerDay);
  const aiDays = new Map(aiPlan.days.map((day) => [day.dayIndex, day]));
  // Lỗi nặng: thiếu ngày nào trong 7 ngày.
  if (!ranked.length || Array.from({ length: 7 }, (_, dayIndex) => aiDays.has(dayIndex)).includes(false)) {
    return { ...fallback(), replacedMeals: slots.length * 7 };
  }

  let replacedMeals = 0;
  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const aiMeals = [...aiDays.get(dayIndex)!.meals];
    const usedToday = new Set<string>();
    const meals = slots.map((mealType) => {
      const index = aiMeals.findIndex((meal) => meal.mealType === mealType);
      const aiMeal = index >= 0 ? aiMeals.splice(index, 1)[0] : undefined;
      const recipe = aiMeal ? allowed.get(aiMeal.recipeId) : undefined;
      if (aiMeal && recipe && fitsMeal(recipe, mealType) && !usedToday.has(recipe.id)) {
        usedToday.add(recipe.id);
        return aiMeal;
      }
      replacedMeals += 1;
      const replacement = pickRecipeForMeal(ranked, mealType, dayIndex, usedToday);
      usedToday.add(replacement.id);
      return { mealType, recipeId: replacement.id, servings: aiMeal?.servings ?? 1, reason: fallbackReason };
    });
    return { dayIndex, meals };
  });

  if (replacedMeals / (slots.length * 7) > MAX_INVALID_AI_MEAL_RATIO) return { ...fallback(), replacedMeals };
  return { plan: { summary: aiPlan.summary, days }, source: replacedMeals ? "ai-corrected" : "ai", replacedMeals };
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
      aiGenerated: source !== "fallback",
      summary: rawPlan.summary,
      days: { create: days.map((day) => ({ date: day.date, items: { create: day.items } })) },
      shoppingItems: { create: shoppingItems },
    },
    include: planInclude,
  });
}

export const planInclude = {
  days: { orderBy: { date: "asc" as const }, include: { items: { include: { recipe: { include: { ingredients: true } } } } } },
  shoppingItems: { orderBy: [{ purchased: "asc" as const }, { name: "asc" as const }] },
};

export function listMealPlans(userId: string) {
  return prisma.mealPlan.findMany({
    where: { userId },
    include: planInclude,
    // Mới nhất trước; trùng ngày bắt đầu thì thực đơn tạo sau đứng trước.
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
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
