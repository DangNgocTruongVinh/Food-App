import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { calorieShare, matchRecipeToPantry, recipeWarnings } from "../../services/recipe-fit.service.js";
import { HttpError } from "../../utils/http-error.js";
import type { RecipeListQuery } from "./recipes.schema.js";

const recipeWithIngredients = { ingredients: true } as const;

/**
 * Số công thức theo nhóm cho Landing (công khai, Guest xem được): chỉ trả số đếm, không trả dữ liệu công thức.
 * Nhóm khớp với nhãn thật của công thức: bữa ăn (mealTypes) và chế độ ăn (dietTags).
 */
export async function getRecipeStats() {
  const [total, breakfast, vegetarian, vegan, lowCarb, highProtein] = await Promise.all([
    prisma.recipe.count(),
    prisma.recipe.count({ where: { mealTypes: { has: "BREAKFAST" } } }),
    prisma.recipe.count({ where: { dietTags: { hasSome: ["VEGETARIAN", "VEGAN"] } } }),
    prisma.recipe.count({ where: { dietTags: { has: "VEGAN" } } }),
    prisma.recipe.count({ where: { dietTags: { has: "LOW_CARB" } } }),
    prisma.recipe.count({ where: { dietTags: { has: "HIGH_PROTEIN" } } }),
  ]);
  return { total, breakfast, vegetarian, vegan, lowCarb, highProtein };
}

export function listRecipes(query: RecipeListQuery) {
  const where: Prisma.RecipeWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.cuisine ? { cuisine: query.cuisine } : {}),
  };

  return prisma.recipe.findMany({
    where,
    include: recipeWithIngredients,
    orderBy: { name: "asc" },
  });
}

export async function getRecipe(id: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: recipeWithIngredients,
  });
  if (!recipe) throw new HttpError(404, "Không tìm thấy công thức.");
  return recipe;
}

/** Khối "Dành cho bạn" ở trang chi tiết công thức, tính cho người dùng đang đăng nhập (userId lấy từ JWT). */
export async function getRecipeForYou(userId: string, id: string, now = new Date()) {
  const [recipe, profile, pantry] = await Promise.all([
    prisma.recipe.findUnique({ where: { id }, include: recipeWithIngredients }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
  ]);
  if (!recipe) throw new HttpError(404, "Không tìm thấy công thức.");
  const pantryMatch = matchRecipeToPantry(recipe, pantry, now);
  return {
    recipeId: recipe.id,
    pantry: { ...pantryMatch, inPantryCount: pantryMatch.inPantry.length },
    calories: calorieShare(recipe.calories, profile),
    warnings: recipeWarnings(recipe, profile),
  };
}
