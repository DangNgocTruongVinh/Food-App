import type { FoodUnit, MealType, Recipe } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { generatePlanWithAI, type GeneratedPlan } from "./ai.service.js";
import { calculateNutritionTargets } from "./nutrition.service.js";

type RecipeWithIngredients = Recipe & { ingredients: Array<{ name: string; quantity: number; unit: FoodUnit }> };

const normalize = (value: string) => value.trim().toLocaleLowerCase("vi");

function fallbackPlan(recipes: RecipeWithIngredients[], pantryNames: Set<string>, mealsPerDay: number): GeneratedPlan {
  const types: MealType[] = mealsPerDay >= 4
    ? ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]
    : ["BREAKFAST", "LUNCH", "DINNER"];
  const scored = recipes
    .map((recipe) => ({
      recipe,
      score: recipe.ingredients.filter((ingredient) => pantryNames.has(normalize(ingredient.name))).length,
    }))
    .sort((a, b) => b.score - a.score || a.recipe.calories - b.recipe.calories);
  if (!scored.length) throw new HttpError(422, "Chưa có công thức phù hợp để tạo thực đơn.");
  return {
    summary: "Thực đơn được tạo bằng thuật toán ưu tiên thực phẩm sẵn có và cân bằng món ăn.",
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex,
      meals: types.map((mealType, mealIndex) => {
        const recipe = scored[(dayIndex * types.length + mealIndex) % scored.length].recipe;
        return { mealType, recipeId: recipe.id, servings: 1, reason: "Phù hợp kho thực phẩm và mục tiêu năng lượng." };
      }),
    })),
  };
}

function isRecipeAllowed(recipe: RecipeWithIngredients, banned: string[]) {
  const text = normalize(`${recipe.name} ${recipe.ingredients.map((item) => item.name).join(" ")}`);
  return !banned.some((item) => text.includes(normalize(item)));
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
  const banned = [...(profile?.allergies ?? []), ...(profile?.dislikedFoods ?? [])];
  const recipes = allRecipes.filter((recipe) => isRecipeAllowed(recipe, banned));
  const pantryNames = new Set(pantry.map((item) => normalize(item.name)));
  const mealsPerDay = profile?.mealsPerDay ?? 3;
  const aiContext = {
    nutritionTargets: targets,
    mealsPerDay,
    dietType: profile?.dietType ?? "BALANCED",
    allergies: profile?.allergies ?? [],
    dislikedFoods: profile?.dislikedFoods ?? [],
    preferredCuisines: profile?.preferredCuisines ?? [],
    pantry: pantry.map(({ name, quantity, unit, expiryDate }) => ({ name, quantity, unit, expiryDate })),
    recipes: recipes.map(({ id, name, calories, proteinG, carbsG, fatG, cuisine, dietTags, ingredients }) => ({
      id, name, calories, proteinG, carbsG, fatG, cuisine, dietTags,
      ingredients: ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    })),
  };

  const rawPlan = (await generatePlanWithAI(aiContext)) ?? fallbackPlan(recipes, pantryNames, mealsPerDay);
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
