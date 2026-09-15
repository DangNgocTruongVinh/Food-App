import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import { getRecipe, listRecipes, normalizeRecipeListParams, type RecipeListParams } from "./recipes.api";

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
  }),
};
