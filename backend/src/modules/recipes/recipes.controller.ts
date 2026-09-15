import type { Response } from "express";
import type { ValidatedRequest } from "../../types/http.js";
import type { RecipeIdParams, RecipeListQuery } from "./recipes.schema.js";
import { getRecipe, listRecipes } from "./recipes.service.js";

export async function listRecipesController(
  req: ValidatedRequest<unknown, Record<string, never>, RecipeListQuery>,
  res: Response,
) {
  res.json(await listRecipes(req.query));
}

export async function getRecipeController(
  req: ValidatedRequest<unknown, RecipeIdParams>,
  res: Response,
) {
  res.json(await getRecipe(req.params.id));
}
