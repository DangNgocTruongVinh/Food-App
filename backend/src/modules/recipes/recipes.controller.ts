import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import { featuredRecipesSchema, type RecipeIdParams, type RecipeListQuery } from "./recipes.schema.js";
import { getFeaturedRecipes, getRecipe, getRecipeForYou, getRecipeStats, listRecipes } from "./recipes.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function getRecipeStatsController(_req: Request, res: Response) {
  res.json(await getRecipeStats());
}

// Query đọc lại từ schema để có giá trị mặc định (validate() không ghi đè req.query).
export async function getFeaturedRecipesController(req: Request, res: Response) {
  res.json(await getFeaturedRecipes(featuredRecipesSchema.shape.query.parse(req.query).limit));
}

export async function listRecipesController(
  req: ValidatedRequest<unknown, Record<string, never>, RecipeListQuery>,
  res: Response,
) {
  res.json(await listRecipes(authenticatedUserId(req), req.query));
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
