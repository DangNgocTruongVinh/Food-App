import { keepPreviousData, mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import {
  createAdminRecipe, deleteAdminRecipe, getAdminRecipe, getAdminStats, listAdminRecipes, setAdminRecipeVisibility, updateAdminRecipe,
  uploadAdminRecipeImage, type AdminRecipeListQuery,
} from "./admin.api";

export const adminQueries = {
  stats: () => queryOptions({ queryKey: queryKeys.admin.stats, queryFn: getAdminStats }),
  recipes: (query: AdminRecipeListQuery) => queryOptions({
    queryKey: queryKeys.admin.recipes(query), queryFn: () => listAdminRecipes(query), placeholderData: keepPreviousData,
  }),
  recipe: (id: string) => queryOptions({ queryKey: queryKeys.admin.recipe(id), queryFn: () => getAdminRecipe(id), retry: retryUnlessClientError }),
};

export const adminMutations = {
  createRecipe: () => mutationOptions({ mutationFn: createAdminRecipe }),
  updateRecipe: () => mutationOptions({ mutationFn: updateAdminRecipe }),
  setVisibility: () => mutationOptions({ mutationFn: setAdminRecipeVisibility }),
  uploadImage: () => mutationOptions({ mutationFn: uploadAdminRecipeImage }),
  deleteRecipe: () => mutationOptions({ mutationFn: deleteAdminRecipe }),
};

/** Sau khi đổi công thức: làm mới danh sách/thống kê Admin và mọi dữ liệu công thức phía người dùng. */
export function invalidateAdminRecipeQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}
