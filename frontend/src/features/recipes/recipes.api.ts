import { api } from "../../api/client";
import type { Recipe } from "../../types";

export interface RecipeListParams {
  search?: string;
  cuisine?: string;
}

export function normalizeRecipeListParams(params: RecipeListParams = {}): RecipeListParams {
  const search = params.search?.trim();
  const cuisine = params.cuisine?.trim();
  return {
    ...(search ? { search } : {}),
    ...(cuisine ? { cuisine } : {}),
  };
}

export async function listRecipes(params: RecipeListParams = {}) {
  const normalized = normalizeRecipeListParams(params);
  return (await api.get<Recipe[]>("/recipes", {
    ...(Object.keys(normalized).length ? { params: normalized } : {}),
  })).data;
}

export async function getRecipe(id: string) {
  return (await api.get<Recipe>(`/recipes/${id}`)).data;
}
