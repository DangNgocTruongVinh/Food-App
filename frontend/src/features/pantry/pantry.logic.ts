import { differenceInCalendarDays } from "date-fns";
import type { FoodUnit, PantryItem, StorageLocation } from "../../types";
import { formatDisplayDate } from "../../utils/date";
import type { PantryFormValues } from "./pantry.api";

export type PantryItemStatus = "good" | "expiring" | "expired";
export type PantryStatusFilter = "all" | PantryItemStatus;
export type PantryView = "list" | "grid";
export type PantryFilters = {
  search: string;
  status: PantryStatusFilter;
  category: string;
  storage: StorageLocation | "all";
  sortBy: string;
};

export const PANTRY_PAGE_SIZE = 8;

export const initialPantryForm: PantryFormValues = {
  name: "", category: "Rau củ", quantity: 1, unit: "ITEM" as FoodUnit,
  storageLocation: "REFRIGERATOR" as StorageLocation, expiryDate: "", minimumStock: 0, note: "",
};

export const storageLabel: Record<StorageLocation, string> = {
  REFRIGERATOR: "Ngăn mát", FREEZER: "Ngăn đông", DRY_STORAGE: "Nơi khô ráo",
};

const statusLabel: Record<PantryItemStatus, string> = { good: "Còn tốt", expiring: "Sắp hết hạn", expired: "Đã hết hạn" };

export function pantryStatusLabel(status: PantryItemStatus) {
  return statusLabel[status];
}

export function getDaysLeft(item: Pick<PantryItem, "expiryDate">, now = new Date()) {
  return item.expiryDate ? differenceInCalendarDays(new Date(item.expiryDate), now) : null;
}

/** Hết hạn khi đã qua ngày; sắp hết hạn khi còn ≤ 3 ngày (cùng ngưỡng với cảnh báo ở backend). */
export function getPantryStatus(item: Pick<PantryItem, "expiryDate">, now = new Date()): PantryItemStatus {
  const days = getDaysLeft(item, now);
  if (days !== null && days < 0) return "expired";
  if (days !== null && days <= 3) return "expiring";
  return "good";
}

export function expiryCopy(item: Pick<PantryItem, "expiryDate">, now = new Date()) {
  const days = getDaysLeft(item, now);
  if (days === null) return { date: "Không thời hạn", relative: "—" };
  const date = formatDisplayDate(item.expiryDate!);
  if (days < 0) return { date, relative: `Quá ${Math.abs(days)} ngày` };
  if (days === 0) return { date, relative: "Hôm nay" };
  return { date, relative: `${days} ngày` };
}

export function pantryCounts(items: PantryItem[], now = new Date()) {
  return {
    total: items.length,
    good: items.filter((item) => getPantryStatus(item, now) === "good").length,
    expiring: items.filter((item) => getPantryStatus(item, now) === "expiring").length,
    expired: items.filter((item) => getPantryStatus(item, now) === "expired").length,
    cold: items.filter((item) => item.storageLocation !== "DRY_STORAGE").length,
  };
}

export type PantryCounts = ReturnType<typeof pantryCounts>;

/** Danh mục kèm số lượng, nhiều nhất trước. */
export function pantryCategories(items: PantryItem[]) {
  const result = new Map<string, number>();
  items.forEach((item) => result.set(item.category, (result.get(item.category) ?? 0) + 1));
  return Array.from(result.entries()).sort((a, b) => b[1] - a[1]);
}

export function filterAndSortPantry(items: PantryItem[], filters: PantryFilters, now = new Date()) {
  const query = filters.search.trim().toLowerCase();
  return items
    .filter((item) => !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
    .filter((item) => filters.status === "all" || getPantryStatus(item, now) === filters.status)
    .filter((item) => filters.category === "all" || item.category === filters.category)
    .filter((item) => filters.storage === "all" || item.storageLocation === filters.storage)
    .sort((a, b) => {
      if (filters.sortBy === "name") return a.name.localeCompare(b.name, "vi");
      if (filters.sortBy === "quantity") return b.quantity - a.quantity;
      const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
}

/** Ước tính đơn giản: 12.000đ cho mỗi thực phẩm còn dùng được. */
export function estimatedSavings(counts: Pick<PantryCounts, "good" | "expiring">) {
  return (counts.good + counts.expiring) * 12000;
}

export function storageTip(item: Pick<PantryItem, "storageLocation">) {
  return item.storageLocation === "DRY_STORAGE"
    ? "Đặt nơi khô ráo, kín và tránh ánh nắng trực tiếp."
    : `Đang để ở ${storageLabel[item.storageLocation].toLowerCase()}. Nên dùng đúng hạn để giữ độ tươi ngon.`;
}

// Trang (bắt đầu từ 1) chứa item trong danh sách đã lọc/sắp xếp; null nếu item không có trong danh sách.
export function pantryItemPage(items: { id: string }[], itemId: string, pageSize: number) {
  const index = items.findIndex((item) => item.id === itemId);
  return index < 0 ? null : Math.floor(index / pageSize) + 1;
}
