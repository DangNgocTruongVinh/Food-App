import type { FoodUnit } from "@prisma/client";
import { canConvertUnit } from "../utils/food-units.js";
import { vietnamToday } from "../utils/vietnam-date.js";
import { normalizeFoodText } from "./dietary.service.js";
import { foodCategoryOf, shelfLifeFor } from "./food-category.js";
import { pantryExpiryState } from "./recipe-fit.service.js";

// "Đã mua" → thêm vào kho (GĐ3b lượt 6): phần tính toán thuần. Đọc/ghi DB ở modules/meal-plans/shopping-purchase.service.ts.

const DAY_MS = 86_400_000;

/**
 * Nhóm, nơi bảo quản và hạn gợi ý cho thực phẩm mới từ "Đã mua". Hạn tính từ hôm nay theo giờ Việt Nam; có hạn thì đánh dấu
 * `expiryEstimated` để giao diện ghi "Hạn ước tính" (người dùng sửa sang ngày khác thì mất cờ).
 */
export function suggestedPantryDefaults(name: string, category: string | null | undefined, now = new Date()) {
  const known = category?.trim() || foodCategoryOf(name);
  // Hạn và nơi bảo quản theo nhóm + loại con (bảng FoodCategory, FoodShelfLifeRule; Admin sửa được).
  const rule = shelfLifeFor(name, known);
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
