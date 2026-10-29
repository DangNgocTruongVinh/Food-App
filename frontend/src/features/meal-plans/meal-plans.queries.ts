import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import {
  deleteMealPlan, generateMealPlan, getMealPlan, listMealPlans,
  updateMealCompletion, updateMealPlanStatus, updateShoppingPurchased,
} from "./meal-plans.api";
import type { MealPlan } from "../../types";

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

/**
 * Sau khi xóa thực đơn: bỏ nó khỏi danh sách ngay (để /meal-plans không mở lại từ danh sách cũ), rồi chỉ làm mới
 * danh sách và Dashboard. Không làm mới chi tiết của thực đơn đã xóa (sẽ 404); trang tự bỏ cache chi tiết đó
 * sau khi đã rời khỏi nó (xem removeMealPlanDetail).
 */
export function removeDeletedMealPlan(queryClient: QueryClient, deletedId: string) {
  queryClient.setQueryData<MealPlan[]>(queryKeys.mealPlans.list(), (plans) => plans?.filter((plan) => plan.id !== deletedId));
  void queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.list() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}

/** Bỏ cache chi tiết; chỉ gọi khi không còn trang nào dùng thực đơn này, nếu không React Query sẽ tải lại nó. */
export function removeMealPlanDetail(queryClient: QueryClient, id: string) {
  queryClient.removeQueries({ queryKey: queryKeys.mealPlans.detail(id) });
}
