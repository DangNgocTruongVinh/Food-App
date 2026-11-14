import type { StorageLocation } from "@prisma/client";
import { normalizeFoodText } from "./dietary.service.js";

/**
 * Nhóm thực phẩm (Kho, danh sách đi chợ) và hạn ước tính khi "Đã mua"/quét hóa đơn. Chỉ có LOGIC: danh mục (8 nhóm, từ đầu tên
 * → nhóm, hạn theo loại con) nằm trong database (FoodCategory, FoodCategoryTerm, FoodShelfLifeRule), nạp bằng setFoodCatalog
 * (services/catalog/catalog.service.ts). Chưa nạp thì báo lỗi, không đoán nhóm.
 */
export type FoodTextMatch = "PREFIX" | "PREFIX_WORD" | "CONTAINS_WORD";
export type ShelfLifeRule = { pattern: string; matchMode: FoodTextMatch; shelfLifeDays: number | null; storage: StorageLocation };
export type FoodCategoryEntry = {
  name: string;
  defaultStorage: StorageLocation;
  defaultShelfLifeDays: number | null;
  isFallback: boolean;
  /** Theo thứ tự ưu tiên; quy tắc đầu tiên khớp tên thắng. */
  shelfLifeRules: ShelfLifeRule[];
};
export type FoodCatalog = {
  /** Theo thứ tự hiển thị. */
  categories: FoodCategoryEntry[];
  /** Từ đầu tên → nhóm, theo thứ tự ưu tiên (ngoại lệ trước: "đậu bắp" là Rau củ). */
  terms: Array<{ prefix: string; category: string }>;
};

let catalog: FoodCatalog | null = null;

export function setFoodCatalog(next: FoodCatalog) {
  catalog = next;
}

function foodCatalog() {
  if (!catalog) throw new Error("Chưa nạp danh mục nhóm thực phẩm (setFoodCatalog).");
  return catalog;
}

/** Nhóm đang dùng (đã bỏ nhóm ẩn), theo thứ tự hiển thị. */
export const foodCategories = () => foodCatalog().categories;
export const foodCategoryNames = () => foodCatalog().categories.map((category) => category.name);
export const isFoodCategory = (name: string) => foodCategoryNames().includes(name);
const fallbackCategory = () => {
  const { categories } = foodCatalog();
  return categories.find((category) => category.isFallback) ?? categories[categories.length - 1];
};

const key = (name: string) => normalizeFoodText(name.normalize("NFC"));

const matches = (text: string, pattern: string, mode: FoodTextMatch) =>
  mode === "PREFIX" ? text.startsWith(pattern)
    : mode === "PREFIX_WORD" ? text === pattern || text.startsWith(`${pattern} `)
      : ` ${text} `.includes(` ${pattern} `);

/** Nhóm của một nguyên liệu/thực phẩm theo từ đầu tên (khớp đầu tiên theo thứ tự ưu tiên); không khớp → nhóm mặc định ("Khác"). */
export function foodCategoryOf(name: string): string {
  const text = key(name);
  return foodCatalog().terms.find((term) => text.startsWith(term.prefix))?.category ?? fallbackCategory().name;
}

/**
 * Hạn (số ngày, null = không đặt hạn) và nơi bảo quản gợi ý: quy tắc loại con của nhóm (hạt khô, đồ khô, bánh mì…) theo thứ tự,
 * không khớp thì theo mặc định của nhóm. Nhóm không còn trong danh mục (nhóm cũ của thực phẩm) → nhóm mặc định.
 */
export function shelfLifeFor(name: string, category: string): { days: number | null; storage: StorageLocation } {
  const entry = foodCatalog().categories.find((item) => item.name === category) ?? fallbackCategory();
  const text = key(name);
  const rule = entry.shelfLifeRules.find((item) => matches(text, item.pattern, item.matchMode));
  return rule ? { days: rule.shelfLifeDays, storage: rule.storage } : { days: entry.defaultShelfLifeDays, storage: entry.defaultStorage };
}

/** Dòng đi chợ cũ (tạo trước GĐ3b lượt 5) chưa có `category`: tính khi đọc, không cần migration dữ liệu. */
export function withFoodCategory<T extends { name: string; category: string | null }>(item: T): T & { category: string } {
  return { ...item, category: item.category?.trim() || foodCategoryOf(item.name) };
}
