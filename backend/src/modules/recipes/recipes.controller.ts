import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type { RecipeIdParams, RecipeListQuery } from "./recipes.schema.js";
import { getRecipe, getRecipeForYou, getRecipeStats, listRecipes } from "./recipes.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function getRecipeStatsController(_req: Request, res: Response) {
  res.json(await getRecipeStats());
}

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

export async function getRecipeForYouController(
  req: ValidatedRequest<unknown, RecipeIdParams>,
  res: Response,
) {
  res.json(await getRecipeForYou(authenticatedUserId(req), req.params.id));
}
