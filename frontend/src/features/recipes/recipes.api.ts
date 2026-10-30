import { api } from "../../api/client";
import type { Recipe, RecipeForYou, RecipeStats } from "../../types";

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

/** Công khai (không cần đăng nhập): chỉ số đếm theo nhóm, dùng cho Landing. */
export async function getRecipeStats() {
  return (await api.get<RecipeStats>("/recipes/stats")).data;
}

export async function getRecipeForYou(id: string) {
  return (await api.get<RecipeForYou>(`/recipes/${id}/for-you`)).data;
}
