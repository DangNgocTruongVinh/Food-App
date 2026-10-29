import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import {
  deleteMealPlan, generateMealPlan, getMealPlan, listMealPlans,
  updateMealCompletion, updateMealPlanStatus, updateShoppingPurchased,
} from "./meal-plans.api";

export const mealPlanQueries = {
  list: () => queryOptions({ queryKey: queryKeys.mealPlans.list(), queryFn: listMealPlans }),
  detail: (id: string) => queryOptions({
    queryKey: queryKeys.mealPlans.detail(id),
    queryFn: () => getMealPlan(id),
    retry: retryUnlessClientError,
  }),
};

export const mealPlanMutations = {
  generate: (startDate: string) => mutationOptions({ mutationFn: () => generateMealPlan(startDate) }),
  updateStatus: () => mutationOptions({ mutationFn: updateMealPlanStatus }),
  updateMeal: () => mutationOptions({ mutationFn: updateMealCompletion }),
  updateShopping: () => mutationOptions({ mutationFn: updateShoppingPurchased }),
  remove: () => mutationOptions({ mutationFn: deleteMealPlan }),
};

export function invalidateMealPlanQueries(queryClient: QueryClient, includeDashboard: boolean) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
  if (includeDashboard) void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}
