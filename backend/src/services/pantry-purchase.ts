import type { FoodUnit, StorageLocation } from "@prisma/client";
import { canConvertUnit } from "../utils/food-units.js";
import { vietnamToday } from "../utils/vietnam-date.js";
import { normalizeFoodText } from "./dietary.service.js";
import { foodCategoryOf, grainKind, legumeKind, type FoodCategory } from "./food-category.js";
import { pantryExpiryState } from "./recipe-fit.service.js";

// "Đã mua" → thêm vào kho (GĐ3b lượt 6): phần tính toán thuần. Đọc/ghi DB ở modules/meal-plans/shopping-purchase.service.ts.

const DAY_MS = 86_400_000;

/** Hạn và nơi bảo quản gợi ý theo nhóm (quyết định 5). null = không đặt hạn. */
const SUGGESTED: Record<FoodCategory, { days: number | null; storage: StorageLocation }> = {
  "Rau củ": { days: 5, storage: "REFRIGERATOR" },
  "Thịt & cá": { days: 2, storage: "REFRIGERATOR" },
  "Trứng & sữa": { days: 7, storage: "REFRIGERATOR" },
  "Đậu & hạt": { days: 3, storage: "REFRIGERATOR" }, // đậu hũ, đậu tươi; hạt khô xem DRY_LEGUME
  "Ngũ cốc": { days: 180, storage: "DRY_STORAGE" }, // đồ khô; đồ tươi xem FRESH_GRAIN
  "Trái cây": { days: 5, storage: "REFRIGERATOR" },
  "Gia vị": { days: 180, storage: "DRY_STORAGE" },
  "Khác": { days: null, storage: "REFRIGERATOR" },
};
const DRY_LEGUME = { days: 90, storage: "DRY_STORAGE" as StorageLocation };
const FRESH_GRAIN = { days: 2, storage: "REFRIGERATOR" as StorageLocation }; // bánh mì, bún tươi, bánh phở…

/**
 * Nhóm, nơi bảo quản và hạn gợi ý cho thực phẩm mới từ "Đã mua". Hạn tính từ hôm nay theo giờ Việt Nam; có hạn thì đánh dấu
 * `expiryEstimated` để giao diện ghi "Hạn ước tính" (người dùng sửa sang ngày khác thì mất cờ).
 */
export function suggestedPantryDefaults(name: string, category: string | null | undefined, now = new Date()) {
  const known = (category?.trim() || foodCategoryOf(name)) as FoodCategory;
  const rule = known === "Đậu & hạt" && legumeKind(name) === "dry" ? DRY_LEGUME
    : known === "Ngũ cốc" && grainKind(name) === "fresh" ? FRESH_GRAIN
    : SUGGESTED[known] ?? SUGGESTED["Khác"];
  const expiryDate = rule.days === null ? null : new Date(vietnamToday(now).getTime() + rule.days * DAY_MS);
  return { category: category?.trim() || known, storageLocation: rule.storage, expiryDate, expiryEstimated: expiryDate !== null };
}

export type PurchasePantryItem = { id: string; name: string; quantity: number; unit: FoodUnit; expiryDate: Date | null };
export type PurchaseTarget<T extends PurchasePantryItem> = { kind: "merge" | "reuse"; item: T } | { kind: "create" };

const expiryKey = (item: PurchasePantryItem) => item.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;

/**
 * Chọn nơi đưa hàng vừa mua vào kho (cùng tên đã chuẩn hóa, cùng đơn vị hoặc quy đổi được):
 * merge — cộng vào món còn số lượng, chưa hết hạn, hạn muộn nhất (không có hạn coi như muộn nhất);
 * reuse — chỉ còn món cùng tên "Đã dùng hết" (số lượng 0): dùng lại món đó (đặt số lượng, hạn gợi ý mới);
 * create — tạo thực phẩm mới. Món còn số lượng nhưng đã hết hạn không được cộng vào.
 */
export function choosePurchaseTarget<T extends PurchasePantryItem>(pantry: T[], name: string, unit: FoodUnit, now = new Date()): PurchaseTarget<T> {
  const sameName = pantry.filter((item) => normalizeFoodText(item.name) === normalizeFoodText(name) && canConvertUnit(unit, item.unit));
  const fresh = sameName
    .filter((item) => item.quantity > 0 && pantryExpiryState(item.expiryDate, now) !== "expired")
    .sort((a, b) => expiryKey(b) - expiryKey(a) || a.id.localeCompare(b.id));
  if (fresh.length) return { kind: "merge", item: fresh[0] };
  const depleted = sameName.filter((item) => item.quantity <= 0).sort((a, b) => a.id.localeCompare(b.id));
  if (depleted.length) return { kind: "reuse", item: depleted[0] };
  return { kind: "create" };
}
