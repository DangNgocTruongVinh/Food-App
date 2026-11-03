import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getApiError } from "../../api/client";
import { queryKeys } from "../../api/query-keys";
import { consumptionSummary, restorationSummary } from "./consumption.logic";
import { updateMealCompletion, type MealConsumption } from "./meal-plans.api";

export type ConsumeTarget = { id: string; recipeName: string };
export type MealNotice = { kind: "done" | "undone" | "error"; target: ConsumeTarget; message: string };

/** Đánh dấu/bỏ đánh dấu đã ăn đổi cả kho: làm mới Thực đơn, Tổng quan, Kho, "Dành cho bạn", thông báo. */
export function invalidateAfterMealChange(queryClient: QueryClient) {
  for (const queryKey of [queryKeys.mealPlans.all, queryKeys.dashboard, queryKeys.pantry, queryKeys.recipes.forYouAll, queryKeys.notifications.all]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/**
 * Luồng "Đã ăn" dùng chung cho Tổng quan và Thực đơn: mở hộp xem trước → xác nhận (trừ kho hoặc chỉ đánh dấu) → dòng nhắc
 * tóm tắt kèm "Hoàn tác"; bỏ đánh dấu → hoàn lại kho và báo những gì không hoàn được.
 */
export function useMealConsumption() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<ConsumeTarget | null>(null);
  const [notice, setNotice] = useState<MealNotice | null>(null);
  const mutation = useMutation({ mutationFn: updateMealCompletion, onSuccess: () => invalidateAfterMealChange(queryClient) });

  const open = (meal: ConsumeTarget) => {
    mutation.reset();
    setTarget(meal);
  };

  const confirm = (consumption: MealConsumption) => {
    if (!target) return;
    const meal = target;
    mutation.mutate({ id: meal.id, completed: true, consumption }, {
      onSuccess: (result) => {
        setTarget(null);
        setNotice({ kind: "done", target: meal, message: consumptionSummary(meal.recipeName, result) });
      },
    });
  };

  const undo = (meal: ConsumeTarget) => {
    mutation.mutate({ id: meal.id, completed: false }, {
      onSuccess: (result) => setNotice({ kind: "undone", target: meal, message: restorationSummary(meal.recipeName, result) }),
      onError: (error) => setNotice({ kind: "error", target: meal, message: `Chưa cập nhật được bữa ${meal.recipeName}. ${getApiError(error)}` }),
    });
  };

  return {
    target,
    open,
    close: () => setTarget(null),
    confirm,
    undo,
    notice,
    dismissNotice: () => setNotice(null),
    pending: mutation.isPending,
    pendingId: mutation.isPending ? mutation.variables?.id ?? null : null,
    /** Lỗi khi xác nhận trong hộp thoại (hộp vẫn mở để thử lại). */
    confirmError: target && mutation.isError ? getApiError(mutation.error) : "",
  };
}
