import type { AllergenTermLevel, FoodTextMatch, ReceiptKeywordMatch, StorageLocation } from "@prisma/client";
import {
  ALLERGEN_GROUP_SEED, FOOD_CATEGORY_SEED, FOOD_CATEGORY_TERM_SEED, PROCESSED_TERM_SEED, RECEIPT_ABBREVIATION_SEED, RECEIPT_SKIP_SEED,
  SHELF_LIFE_RULE_SEED,
} from "../../../prisma/catalog-data.js";
import { type AllergyGroup, setAllergyCatalog } from "../allergy-groups.js";
import { type FoodCatalog, setFoodCatalog } from "../food-category.js";
import { type ReceiptCatalog, setReceiptCatalog } from "../receipt/receipt-catalog.js";
import type { ReceiptSkipReason } from "../receipt/receipt-types.js";

/**
 * Dựng danh mục dùng trong bộ nhớ từ các DÒNG BẢNG (cùng dạng Prisma trả về). Dữ liệu thật đi qua loadCatalog (catalog.service.ts,
 * đọc database); test và script đánh giá mô phỏng đi qua useSeedCatalog — cùng các hàm dựng dưới đây, chỉ khác nguồn dòng.
 * File này không truy cập database (test nạp được mà không cần Prisma).
 */
type Hidden = { hiddenAt: Date | null };
export type AllergenGroupRow = Hidden & {
  code: string; label: string; parentCode: string | null; sortOrder: number;
  aliases: Array<Hidden & { name: string; sortOrder: number }>;
  terms: Array<Hidden & { name: string; level: AllergenTermLevel; processed: boolean; sortOrder: number }>;
  exclusions: Array<{ phrase: string }>;
};
export type FoodCategoryRow = Hidden & {
  name: string; sortOrder: number; defaultStorage: StorageLocation; defaultShelfLifeDays: number | null; isFallback: boolean;
  terms: Array<{ prefix: string; priority: number }>;
  shelfLifeRules: Array<{ pattern: string; matchMode: FoodTextMatch; shelfLifeDays: number | null; storage: StorageLocation; priority: number }>;
};
export type ReceiptAbbreviationRow = Hidden & { abbreviation: string; fullName: string; sortOrder: number };
export type ReceiptSkipKeywordRow = { reason: string; reasonOrder: number; keyword: string; matchMode: ReceiptKeywordMatch; sortOrder: number };
export type CatalogRows = {
  allergenGroups: AllergenGroupRow[];
  foodCategories: FoodCategoryRow[];
  receiptAbbreviations: ReceiptAbbreviationRow[];
  receiptSkipKeywords: ReceiptSkipKeywordRow[];
};

const visible = <T extends Hidden>(rows: T[]) => rows.filter((row) => !row.hiddenAt);
const bySort = <T extends { sortOrder: number }>(rows: T[]) => [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

/** Nhóm ẩn bị bỏ; nhóm có nhóm con (đang hiện) là nhóm gộp (`covers`). Thứ tự nhóm và nguyên liệu theo sortOrder. */
export function buildAllergyGroups(rows: AllergenGroupRow[]): AllergyGroup[] {
  const groups = bySort(visible(rows));
  return groups.map((group) => {
    const terms = bySort(visible(group.terms));
    const children = groups.filter((child) => child.parentCode === group.code).map((child) => child.code);
    const mayContain = terms.filter((term) => term.level === "MAY_CONTAIN").map((term) => term.name);
    const processed = terms.filter((term) => term.processed && term.level === "CONTAINS").map((term) => term.name);
    return {
      id: group.code,
      label: group.label,
      aliases: bySort(visible(group.aliases)).map((alias) => alias.name),
      terms: terms.filter((term) => term.level === "CONTAINS").map((term) => term.name),
      ...(mayContain.length ? { mayContain } : {}),
      ...(group.exclusions.length ? { excludes: group.exclusions.map((item) => item.phrase) } : {}),
      ...(children.length ? { covers: children } : {}),
      ...(processed.length ? { processed } : {}),
    };
  });
}

export function buildFoodCatalog(rows: FoodCategoryRow[]): FoodCatalog {
  const categories = bySort(visible(rows));
  const byPriority = <T extends { priority: number }>(items: T[]) => items.map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.priority - b.item.priority || a.index - b.index).map(({ item }) => item);
  return {
    categories: categories.map((category) => ({
      name: category.name,
      defaultStorage: category.defaultStorage,
      defaultShelfLifeDays: category.defaultShelfLifeDays,
      isFallback: category.isFallback,
      shelfLifeRules: byPriority(category.shelfLifeRules).map(({ pattern, matchMode, shelfLifeDays, storage }) => ({ pattern, matchMode, shelfLifeDays, storage })),
    })),
    terms: byPriority(categories.flatMap((category) => category.terms.map((term) => ({ ...term, category: category.name }))))
      .map(({ prefix, category }) => ({ prefix, category })),
  };
}

export function buildReceiptCatalog(abbreviations: ReceiptAbbreviationRow[], keywords: ReceiptSkipKeywordRow[]): ReceiptCatalog {
  return {
    abbreviations: bySort(visible(abbreviations)).map((row) => [row.abbreviation, row.fullName]),
    skipKeywords: [...keywords].sort((a, b) => a.reasonOrder - b.reasonOrder || a.sortOrder - b.sortOrder)
      .map((row) => ({ reason: row.reason as ReceiptSkipReason, keyword: row.keyword, matchMode: row.matchMode })),
  };
}

/** Đưa danh mục vào bộ nhớ cho mọi hàm lọc/nhóm/đọc hóa đơn (gọi lại khi Admin sửa). */
export function applyCatalog(rows: CatalogRows) {
  setAllergyCatalog(buildAllergyGroups(rows.allergenGroups));
  setFoodCatalog(buildFoodCatalog(rows.foodCategories));
  setReceiptCatalog(buildReceiptCatalog(rows.receiptAbbreviations, rows.receiptSkipKeywords));
}

/** Dữ liệu ban đầu (prisma/catalog-data.ts) dưới dạng dòng bảng: dùng để seed database và nạp cho test/script mô phỏng. */
export function seedCatalogRows(): CatalogRows {
  const coverParent = new Map(ALLERGEN_GROUP_SEED.flatMap((group) => (group.covers ?? []).map((child) => [child, group.id] as const)));
  const allergenGroups = ALLERGEN_GROUP_SEED.map((group, index): AllergenGroupRow => ({
    code: group.id, label: group.label, parentCode: coverParent.get(group.id) ?? null, sortOrder: index, hiddenAt: null,
    aliases: group.aliases.map((name, order) => ({ name, sortOrder: order, hiddenAt: null })),
    terms: [
      ...group.terms.map((name) => ({ name, level: "CONTAINS" as const })),
      ...(group.mayContain ?? []).map((name) => ({ name, level: "MAY_CONTAIN" as const })),
    ].map((term, order) => ({ ...term, processed: PROCESSED_TERM_SEED.has(term.name), sortOrder: order, hiddenAt: null })),
    exclusions: (group.excludes ?? []).map((phrase) => ({ phrase })),
  }));
  const foodCategories = FOOD_CATEGORY_SEED.map((category, index): FoodCategoryRow => ({
    ...category, isFallback: Boolean(category.isFallback), sortOrder: index, hiddenAt: null,
    terms: FOOD_CATEGORY_TERM_SEED.flatMap(([name, prefixes], priority) => (name === category.name ? prefixes.map((prefix) => ({ prefix, priority })) : [])),
    shelfLifeRules: SHELF_LIFE_RULE_SEED.flatMap((rule, priority) => (rule.category === category.name
      ? rule.patterns.map((pattern) => ({ pattern, matchMode: rule.matchMode, shelfLifeDays: rule.shelfLifeDays, storage: rule.storage, priority }))
      : [])),
  }));
  const receiptAbbreviations = RECEIPT_ABBREVIATION_SEED.map(([abbreviation, fullName], index) => ({ abbreviation, fullName, sortOrder: index, hiddenAt: null }));
  const modes = ["WORD", "PREFIX", "LINE", "LINE_SUFFIX"] as const;
  const receiptSkipKeywords = RECEIPT_SKIP_SEED.flatMap((rule, reasonOrder) => modes.flatMap((matchMode) =>
    (rule[matchMode] ?? []).map((keyword, sortOrder) => ({ reason: rule.reason, reasonOrder, keyword, matchMode, sortOrder }))));
  return { allergenGroups, foodCategories, receiptAbbreviations, receiptSkipKeywords };
}

/** Test và script đánh giá mô phỏng (không có database): nạp đúng dữ liệu ban đầu qua cùng các hàm dựng. */
export function useSeedCatalog() {
  applyCatalog(seedCatalogRows());
}
