import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getApiError } from "../../api/client";
import type { ShoppingItem } from "../../types";
import { updateShoppingPurchased } from "./meal-plans.api";
import { purchaseNotice, type ShoppingNotice, unpurchaseNotice } from "./shopping-purchase.logic";
import { invalidateAfterMealChange } from "./useMealConsumption";

/**
 * Tick "Đã mua" ở danh sách đi chợ: không mở hộp thoại, backend thêm vào kho (cộng vào / dùng lại / tạo mới) rồi dòng nhắc nêu
 * đã thêm gì kèm "Sửa"; bỏ tick thì hoàn lại và báo. Làm mới Thực đơn, Tổng quan, Kho, "Dành cho bạn", thông báo.
 */
export function useShoppingPurchase() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<ShoppingNotice | null>(null);
  const mutation = useMutation({
    mutationFn: updateShoppingPurchased,
    onSuccess: (result, { purchased }) => {
      invalidateAfterMealChange(queryClient);
      setNotice(purchased ? purchaseNotice(result) : unpurchaseNotice(result));
    },
    onError: (error) => setNotice({ kind: "error", message: `Chưa cập nhật được danh sách đi chợ. ${getApiError(error)}`, pantryItemId: null }),
  });

  return {
    toggle: (item: ShoppingItem) => mutation.mutate({ id: item.id, purchased: !item.purchased }),
    notice,
    dismissNotice: () => setNotice(null),
    pendingId: mutation.isPending ? mutation.variables?.id ?? null : null,
  };
}
