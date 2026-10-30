import { queryOptions } from "@tanstack/react-query";
import { retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import { getRecipe, getRecipeForYou, listRecipes, normalizeRecipeListParams, type RecipeListParams } from "./recipes.api";

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
  // Phụ thuộc kho và hồ sơ: các mutation kho/hồ sơ làm mới nhóm khóa forYouAll.
  forYou: (id: string) => queryOptions({
    queryKey: queryKeys.recipes.forYou(id),
    queryFn: () => getRecipeForYou(id),
    retry: retryUnlessClientError,
  }),
};
