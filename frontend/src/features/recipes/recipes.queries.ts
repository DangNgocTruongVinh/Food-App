import { queryOptions } from "@tanstack/react-query";
import { retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import { getRecipe, getRecipeForYou, getRecipeStats, listFeaturedRecipes, listRecipes, normalizeRecipeListParams, type RecipeListParams } from "./recipes.api";

export const recipeQueries = {
  list: (params: RecipeListParams = {}) => {
    const normalized = normalizeRecipeListParams(params);
    return queryOptions({
      queryKey: queryKeys.recipes.list(normalized),
      queryFn: () => listRecipes(normalized),
    });
  },
  detail: (id: string) => queryOptions({
    queryKey: queryKeys.recipes.detail(id),
    queryFn: () => getRecipe(id),
    retry: retryUnlessClientError,
  }),
  stats: () => queryOptions({ queryKey: queryKeys.recipes.stats, queryFn: getRecipeStats }),
  featured: (limit = 6) => queryOptions({ queryKey: queryKeys.recipes.featured(limit), queryFn: () => listFeaturedRecipes(limit) }),
  // Phụ thuộc kho và hồ sơ: các mutation kho/hồ sơ làm mới nhóm khóa forYouAll.
  forYou: (id: string) => queryOptions({
    queryKey: queryKeys.recipes.forYou(id),
    queryFn: () => getRecipeForYou(id),
    retry: retryUnlessClientError,
  }),
};
