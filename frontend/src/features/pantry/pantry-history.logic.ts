import type { PantryTransaction, PantryTransactionSource } from "../../types";
import { formatDayMonth, vietnamTime } from "../../utils/date";
import { mealLabels } from "../meal-plans/meal-plans.logic";
import { formatPantryQuantity } from "./pantry.logic";

// Lịch sử kho (GĐ3b lượt 7): logic thuần cho phần "Lịch sử" ở trang Kho và "Xem lịch sử" trong hộp thoại Sửa.

export const HISTORY_PAGE_SIZE = 20;
export const ITEM_HISTORY_PAGE_SIZE = 10;

export const HISTORY_SOURCE_LABELS: Record<PantryTransactionSource, string> = {
  MANUAL_ADD: "Nhập tay",
  MANUAL_EDIT: "Sửa tay",
  MANUAL_DELETE: "Xóa",
  CONSUMPTION: "Tiêu thụ",
  PURCHASE: "Mua sắm",
  RECEIPT_SCAN: "Quét hóa đơn",
};
export const HISTORY_SOURCES = Object.keys(HISTORY_SOURCE_LABELS) as PantryTransactionSource[];

/** "+500 g" / "−200 g" (dấu trừ thật để trình đọc màn hình đọc "trừ"); 0 → "0 g". */
export function historyDelta(entry: Pick<PantryTransaction, "delta" | "unit">) {
  const amount = formatPantryQuantity(Math.abs(entry.delta), entry.unit);
  if (entry.delta > 0) return `+${amount}`;
  return entry.delta < 0 ? `−${amount}` : amount;
}

/** Số còn lại sau thay đổi; thực phẩm bị xóa thì ghi rõ. */
export function historyAfter(entry: Pick<PantryTransaction, "quantityAfter" | "unit" | "source">) {
  if (entry.source === "MANUAL_DELETE") return "Đã xóa khỏi kho";
  return `Còn ${formatPantryQuantity(entry.quantityAfter, entry.unit)}`;
}

/** Dòng hoàn lại (bỏ "đã ăn"/"đã mua") ghi "Hoàn lại"; dòng gốc đã được hoàn ghi "Đã hoàn lại". */
export function historyReversalTag(entry: Pick<PantryTransaction, "reversalOfId" | "reversedAt">) {
  if (entry.reversalOfId) return "Hoàn lại";
  return entry.reversedAt ? "Đã hoàn lại" : null;
}

/** Liên kết tới bữa ăn (thực đơn chứa bữa) hoặc danh sách đi chợ của thực đơn; không có thì null. */
export function historyLink(entry: Pick<PantryTransaction, "mealPlanItem" | "shoppingItem">) {
  const meal = entry.mealPlanItem;
  if (meal) {
    return {
      to: `/meal-plans/${meal.day.mealPlanId}`,
      label: `${mealLabels[meal.mealType]} ${formatDayMonth(meal.day.date)}: ${meal.recipe.name}`,
    };
  }
  if (entry.shoppingItem) return { to: `/meal-plans/${entry.shoppingItem.mealPlanId}`, label: "Danh sách đi chợ của thực đơn" };
  return null;
}

/** Ghi chú cho người dùng (vd. "Đổi đơn vị: 2 cái → 300 g", "Tạo mới từ danh sách đi chợ"). */
export const historyNote = (entry: Pick<PantryTransaction, "note">) => entry.note?.trim() || null;

export const historyTime = (entry: Pick<PantryTransaction, "createdAt">) => vietnamTime(entry.createdAt);

/** "Hiển thị 21–40 trong 57 thay đổi". */
export function historyRange(page: number, pageSize: number, total: number) {
  if (!total) return "Không có thay đổi nào";
  const first = (page - 1) * pageSize + 1;
  return `Hiển thị ${first}–${Math.min(page * pageSize, total)} trong ${total} thay đổi`;
}

export const historyPageCount = (pageSize: number, total: number) => Math.max(1, Math.ceil(total / pageSize));
