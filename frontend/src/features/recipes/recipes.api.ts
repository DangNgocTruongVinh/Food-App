import { api } from "../../api/client";
import type { FeaturedRecipe, Recipe, RecipeForYou, RecipeStats } from "../../types";

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

/** UC24: món yêu thích của chính người dùng (mới thêm trước, bỏ món đã ngừng sử dụng). */
export async function listFavoriteRecipes() {
  return (await api.get<Recipe[]>("/recipes/favorites")).data;
}

/** Bật (PUT) / tắt (DELETE) yêu thích; gọi lại nhiều lần vẫn cùng kết quả. */
export async function setRecipeFavorite({ id, favorite }: { id: string; favorite: boolean }) {
  const response = favorite ? await api.put(`/recipes/${id}/favorite`) : await api.delete(`/recipes/${id}/favorite`);
  return response.data as { recipeId: string; favorite: boolean };
}

/** Công khai (không cần đăng nhập): chỉ số đếm theo nhóm, dùng cho Landing. */
export async function getRecipeStats() {
  return (await api.get<RecipeStats>("/recipes/stats")).data;
}

/** Công khai (không cần đăng nhập): món tiêu biểu cho Landing (tối đa 12). */
export async function listFeaturedRecipes(limit: number) {
  return (await api.get<FeaturedRecipe[]>("/recipes/featured", { params: { limit } })).data;
}

export async function getRecipeForYou(id: string) {
  return (await api.get<RecipeForYou>(`/recipes/${id}/for-you`)).data;
}
