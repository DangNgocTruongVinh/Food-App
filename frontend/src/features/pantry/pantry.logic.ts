import { differenceInCalendarDays } from "date-fns";
import type { FoodUnit, PantryItem, StorageLocation } from "../../types";
import { formatDisplayDate } from "../../utils/date";
import { FOOD_CATEGORIES } from "../../utils/food-categories";
import { foodUnitLabel } from "../../utils/units";
import type { PantryFormValues } from "./pantry.api";

/** depleted: số lượng 0 (giữ lại trong kho sau khi trừ hết, GĐ3b quyết định 1). */
export type PantryItemStatus = "good" | "expiring" | "expired" | "depleted";
export type PantryStatusFilter = "all" | PantryItemStatus;
export type PantryView = "list" | "grid";
export type PantryFilters = {
  search: string;
  status: PantryStatusFilter;
  category: string;
  storage: StorageLocation | "all";
  sortBy: string;
  /** Chỉ hiện thực phẩm dưới mức tồn kho tối thiểu (ô thống kê thứ tư). */
  lowStock: boolean;
};

export const PANTRY_PAGE_SIZE = 8;

export const initialPantryForm: PantryFormValues = {
  name: "", category: "Rau củ", quantity: 1, unit: "ITEM" as FoodUnit,
  storageLocation: "REFRIGERATOR" as StorageLocation, expiryDate: "", minimumStock: 0, note: "",
};

/** Bộ 8 nhóm chung với danh sách đi chợ; nhóm cũ của thực phẩm đã có vẫn giữ (pantryCategoryOptions). */
export const PANTRY_CATEGORIES: string[] = [...FOOD_CATEGORIES];

/** Nhóm của thực phẩm đang sửa không có trong danh sách cố định thì vẫn giữ làm một lựa chọn. */
export function pantryCategoryOptions(current: string) {
  return !current || PANTRY_CATEGORIES.includes(current) ? PANTRY_CATEGORIES : [current, ...PANTRY_CATEGORIES];
}

export const storageLabel: Record<StorageLocation, string> = {
  REFRIGERATOR: "Ngăn mát", FREEZER: "Ngăn đông", DRY_STORAGE: "Nơi khô ráo",
};

const statusLabel: Record<PantryItemStatus, string> = { good: "Còn tốt", expiring: "Sắp hết hạn", expired: "Đã hết hạn", depleted: "Đã dùng hết" };

export function pantryStatusLabel(status: PantryItemStatus) {
  return statusLabel[status];
}

export function getDaysLeft(item: Pick<PantryItem, "expiryDate">, now = new Date()) {
  return item.expiryDate ? differenceInCalendarDays(new Date(item.expiryDate), now) : null;
}

/**
 * Đã dùng hết khi số lượng 0 (ưu tiên hơn hạn dùng); hết hạn khi đã qua ngày; sắp hết hạn khi còn ≤ 3 ngày
 * (cùng ngưỡng với cảnh báo ở backend).
 */
export function getPantryStatus(item: Pick<PantryItem, "expiryDate"> & { quantity?: number }, now = new Date()): PantryItemStatus {
  if (item.quantity !== undefined && item.quantity <= 0) return "depleted";
  const days = getDaysLeft(item, now);
  if (days !== null && days < 0) return "expired";
  if (days !== null && days <= 3) return "expiring";
  return "good";
}

/** Ngày hết hạn và số ngày còn lại ("Còn 2 ngày"); relative rỗng khi không có hạn. */
export function expiryCopy(item: Pick<PantryItem, "expiryDate">, now = new Date()) {
  const days = getDaysLeft(item, now);
  if (days === null) return { date: "Không có hạn", relative: "" };
  const date = formatDisplayDate(item.expiryDate!);
  if (days < 0) return { date, relative: `Quá hạn ${Math.abs(days)} ngày` };
  if (days === 0) return { date, relative: "Hết hạn hôm nay" };
  return { date, relative: `Còn ${days} ngày` };
}

export function formatPantryQuantity(quantity: number, unit: FoodUnit) {
  return `${quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${foodUnitLabel[unit]}`;
}

/** Cùng điều kiện với thông báo "Thực phẩm sắp hết" ở backend: có mức tối thiểu và số lượng ≤ mức đó. */
export function isBelowMinimum(item: Pick<PantryItem, "quantity" | "minimumStock">) {
  return item.minimumStock > 0 && item.quantity <= item.minimumStock;
}

export function stockWarning(item: Pick<PantryItem, "quantity" | "minimumStock" | "unit">) {
  if (!isBelowMinimum(item)) return null;
  const minimum = formatPantryQuantity(item.minimumStock, item.unit);
  return item.quantity < item.minimumStock ? `Dưới mức tối thiểu ${minimum}` : `Chạm mức tối thiểu ${minimum}`;
}

export function pantryCounts(items: PantryItem[], now = new Date()) {
  return {
    // "Tất cả" chỉ đếm thực phẩm còn số lượng; món đã dùng hết đếm riêng (ghi chú dưới ô).
    total: items.filter((item) => item.quantity > 0).length,
    depleted: items.filter((item) => item.quantity <= 0).length,
    good: items.filter((item) => getPantryStatus(item, now) === "good").length,
    expiring: items.filter((item) => getPantryStatus(item, now) === "expiring").length,
    expired: items.filter((item) => getPantryStatus(item, now) === "expired").length,
    lowStock: items.filter(isBelowMinimum).length,
  };
}

export type PantryCounts = ReturnType<typeof pantryCounts>;

/** Bốn ô thống kê đầu trang, mỗi ô là một bộ lọc. */
export type PantryStatFilter = "all" | "expiring" | "expired" | "lowStock";

/** Ô đang được chọn theo bộ lọc hiện tại; null khi bộ lọc tình trạng không ứng với ô nào ("Còn tốt", "Đã dùng hết"). */
export function activeStatFilter(filters: Pick<PantryFilters, "status" | "lowStock">): PantryStatFilter | null {
  if (filters.lowStock) return filters.status === "all" ? "lowStock" : null;
  if (filters.status === "all") return "all";
  return filters.status === "good" || filters.status === "depleted" ? null : filters.status;
}

/** Bấm một ô: bật bộ lọc của ô đó; bấm lại ô đang chọn thì về "Tất cả". */
export function applyStatFilter(stat: PantryStatFilter, current: Pick<PantryFilters, "status" | "lowStock">) {
  const next = stat === activeStatFilter(current) ? "all" : stat;
  if (next === "lowStock") return { status: "all" as const, lowStock: true };
  return { status: next, lowStock: false };
}

/** Danh mục kèm số lượng, nhiều nhất trước. */
export function pantryCategories(items: PantryItem[]) {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(item.category, (result.get(item.category) ?? 0) + 1));
  return Array.from(result.entries()).sort((a, b) => b[1] - a[1]);
}

const expiryTime = (item: Pick<PantryItem, "expiryDate">) => (item.expiryDate ? new Date(item.expiryDate).getTime() : Number.MAX_SAFE_INTEGER);

export function filterAndSortPantry(items: PantryItem[], filters: PantryFilters, now = new Date()) {
  const query = filters.search.trim().toLowerCase();
  return items
    .filter((item) => !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
    .filter((item) => filters.status === "all" || getPantryStatus(item, now) === filters.status)
    .filter((item) => filters.category === "all" || item.category === filters.category)
    .filter((item) => filters.storage === "all" || item.storageLocation === filters.storage)
    .filter((item) => !filters.lowStock || isBelowMinimum(item))
    .sort((a, b) => {
      // Món đã dùng hết luôn xếp cuối (trừ khi sắp theo số lượng, khi đó tự nằm cuối).
      const depleted = Number(a.quantity <= 0) - Number(b.quantity <= 0);
      if (depleted && filters.sortBy !== "quantity") return depleted;
      if (filters.sortBy === "name") return a.name.localeCompare(b.name, "vi");
      if (filters.sortBy === "quantity") return b.quantity - a.quantity;
      return expiryTime(a) - expiryTime(b);
    });
}

/** Cột "Cần dùng sớm": món sắp hết hạn và đã hết hạn, hạn gần nhất trước. */
export function itemsToUseSoon(items: PantryItem[], now = new Date()) {
  const byStatus = (status: PantryItemStatus) => items
    .filter((item) => getPantryStatus(item, now) === status)
    .sort((a, b) => expiryTime(a) - expiryTime(b));
  return { expiring: byStatus("expiring"), expired: byStatus("expired") };
}

// Trang (bắt đầu từ 1) chứa item trong danh sách đã lọc/sắp xếp; null nếu item không có trong danh sách.
export function pantryItemPage(items: { id: string }[], itemId: string, pageSize: number) {
  const index = items.findIndex((item) => item.id === itemId);
  return index < 0 ? null : Math.floor(index / pageSize) + 1;
}

export type PantryFormField = "name" | "expiryDate" | "quantity" | "minimumStock" | "note";
export type PantryFormErrors = Partial<Record<PantryFormField, string>>;

/** Lỗi theo từng trường, nói rõ cách sửa. Hạn sử dụng trống là hợp lệ (không có hạn). */
export function validatePantryForm(form: PantryFormValues, expiryDateInvalid: boolean): PantryFormErrors {
  const errors: PantryFormErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Nhập tên thực phẩm, ví dụ: Ức gà.";
  else if (name.length > 100) errors.name = "Rút tên xuống tối đa 100 ký tự.";
  if (expiryDateInvalid) errors.expiryDate = "Ngày không hợp lệ. Nhập theo dạng dd/mm/yyyy, hoặc để trống nếu không có hạn.";
  if (!Number.isFinite(form.quantity) || form.quantity <= 0) errors.quantity = "Nhập số lượng lớn hơn 0.";
  if (!Number.isFinite(form.minimumStock) || form.minimumStock < 0) errors.minimumStock = "Nhập 0 hoặc một số dương.";
  if (form.note.length > 300) errors.note = `Rút ghi chú xuống tối đa 300 ký tự (hiện có ${form.note.length}).`;
  return errors;
}

/** Thông báo sau thao tác, dùng đúng động từ của nút. */
export function pantryDoneMessage(action: "create" | "update" | "delete", name: string) {
  if (action === "create") return `Đã lưu “${name}” vào kho.`;
  if (action === "update") return `Đã lưu thay đổi cho “${name}”.`;
  return `Đã xóa “${name}” khỏi kho.`;
}
