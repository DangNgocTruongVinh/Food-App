import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import type { RecipeListQuery } from "./recipes.schema.js";

const recipeWithIngredients = { ingredients: true } as const;

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
