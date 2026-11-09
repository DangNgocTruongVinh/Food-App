import type { FoodUnit, StorageLocation } from "@prisma/client";
import { expandRestrictedTerms, overlapsFoodTerms } from "../dietary.service.js";
import { foodCategoryOf, type FoodCategory } from "../food-category.js";
import { choosePurchaseTarget, suggestedPantryDefaults, type PurchasePantryItem } from "../pantry-purchase.js";
import { RECEIPT_ALIASES } from "./receipt-aliases.js";
import { foldText, hasVietnameseMarks, sentenceCase } from "./receipt-text.js";
import type { RawReceiptItem } from "./receipt-types.js";

// Chuẩn hóa dòng hàng đọc được thành dòng nháp cho màn duyệt (GĐ3c): tên có dấu, nhóm, nơi bảo quản, hạn (đọc được hoặc
// ước tính theo nhóm), đích trong kho (cộng vào/dùng lại/tạo mới, như "Đã mua") và cảnh báo dị ứng/không thích. Thuần.

export type ReceiptLineFlag = "LOW_CONFIDENCE" | "QUANTITY_GUESSED" | "UNIT_GUESSED" | "NAME_UNMATCHED" | "PRICE_MISMATCH";
export type ReceiptLineTarget =
  | { kind: "merge" | "reuse"; pantryItemId: string; name: string; quantity: number; unit: FoodUnit }
  | { kind: "create" };

export type ReceiptDraftLine = {
  key: string;
  rawText: string;
  name: string;
  quantity: number;
  unit: FoodUnit;
  category: FoodCategory;
  storageLocation: StorageLocation;
  /** yyyy-MM-dd */
  expiryDate: string | null;
  expiryEstimated: boolean;
  price: number | null;
  target: ReceiptLineTarget;
  warnings: Array<{ kind: "ALLERGY" | "DISLIKED"; term: string }>;
  flags: ReceiptLineFlag[];
};

export type NormalizeContext = {
  pantry: PurchasePantryItem[];
  /** Tên nguyên liệu của bộ món (có dấu). */
  knownNames: string[];
  allergies: string[];
  dislikedFoods: string[];
  now: Date;
};

/** Dưới ngưỡng này (0–100, theo Tesseract) thì tô dòng để người dùng xem kỹ. */
export const LOW_CONFIDENCE = 70;

type NameLevel = { exact: Map<string, Set<string>>; prefixes: Array<[string, string]> };
export type NameIndex = NameLevel[];

const MIN_PREFIX = 3;

function buildLevel(pairs: Array<[string, string]>): NameLevel {
  const exact = new Map<string, Set<string>>();
  for (const [folded, canonical] of pairs) {
    if (!folded) continue;
    exact.set(folded, (exact.get(folded) ?? new Set()).add(canonical));
  }
  // Tên bỏ dấu trùng nhau nhưng khác tên có dấu ("ca" = "cá"/"cà") thì không dùng để đoán.
  const prefixes = [...exact].filter(([folded, names]) => names.size === 1 && folded.length >= MIN_PREFIX)
    .map(([folded, names]) => [folded, [...names][0]] as [string, string])
    .sort((a, b) => b[0].length - a[0].length);
  return { exact, prefixes };
}

/** Thứ tự ưu tiên: tên trong kho của người dùng → tên nguyên liệu của bộ món → bảng viết tắt hóa đơn. */
export function buildNameIndex(pantryNames: string[], knownNames: string[]): NameIndex {
  const own = (names: string[]) => names.map((name) => [foldText(name), name.trim().replace(/\s+/g, " ")] as [string, string]);
  return [buildLevel(own(pantryNames)), buildLevel(own(knownNames)), buildLevel(RECEIPT_ALIASES)];
}

/**
 * Tên có dấu cho tên đọc được: trùng hẳn (bỏ dấu) với tên đã biết, hoặc bắt đầu bằng một tên đã biết theo nguyên từ
 * ("rau muong vietgap" → "Rau muống"; lấy tên dài nhất). Không khớp: giữ tên đọc được (viết hoa toàn bộ thì đổi về chữ thường).
 */
export function canonicalFoodName(name: string, index: NameIndex) {
  const folded = foldText(name);
  for (const level of index) {
    const exact = level.exact.get(folded);
    if (exact?.size === 1) return { name: [...exact][0], matched: true };
    if (exact && exact.size > 1) {
      const same = [...exact].find((candidate) => candidate.normalize("NFC") === name.normalize("NFC"));
      if (same) return { name: same, matched: true };
    }
  }
  for (const level of index) {
    const prefix = level.prefixes.find(([known]) => folded.startsWith(`${known} `));
    if (prefix) return { name: prefix[1], matched: true };
  }
  return { name: hasVietnameseMarks(name) ? name : sentenceCase(name), matched: false };
}

const isoDate = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

function warningsFor(name: string, allergyTerms: string[], dislikedTerms: string[]) {
  return [
    ...allergyTerms.filter((term) => overlapsFoodTerms([name], [term])).map((term) => ({ kind: "ALLERGY" as const, term })),
    ...dislikedTerms.filter((term) => overlapsFoodTerms([name], [term])).map((term) => ({ kind: "DISLIKED" as const, term })),
  ];
}

/** Dòng hàng đọc được → dòng nháp. Thiếu số lượng thì 1; thiếu đơn vị thì số lẻ là kg (hàng cân), số nguyên là cái. */
export function normalizeReceiptItems(items: RawReceiptItem[], context: NormalizeContext): ReceiptDraftLine[] {
  const index = buildNameIndex(context.pantry.map((item) => item.name), context.knownNames);
  const allergyTerms = expandRestrictedTerms(context.allergies);
  const dislikedTerms = expandRestrictedTerms(context.dislikedFoods);
  return items.map((item, position) => {
    const flags: ReceiptLineFlag[] = [];
    const canonical = canonicalFoodName(item.name, index);
    if (!canonical.matched) flags.push("NAME_UNMATCHED");
    const quantity = item.quantity ?? 1;
    if (item.quantity === null) flags.push("QUANTITY_GUESSED");
    const unit: FoodUnit = item.unit ?? (Number.isInteger(quantity) ? "ITEM" : "KG");
    if (item.unit === null) flags.push("UNIT_GUESSED");
    if (item.consistent === false) flags.push("PRICE_MISMATCH");
    if (item.confidence !== null && item.confidence < LOW_CONFIDENCE) flags.push("LOW_CONFIDENCE");

    const category = foodCategoryOf(canonical.name);
    const suggested = suggestedPantryDefaults(canonical.name, category, context.now);
    const target = choosePurchaseTarget(context.pantry, canonical.name, unit, context.now);
    return {
      key: `l${position + 1}`,
      rawText: item.rawText,
      name: canonical.name,
      quantity,
      unit,
      category,
      storageLocation: suggested.storageLocation,
      expiryDate: item.expiryDate ?? isoDate(suggested.expiryDate),
      expiryEstimated: item.expiryDate ? false : suggested.expiryEstimated,
      price: item.price,
      target: target.kind === "create"
        ? { kind: "create" }
        : { kind: target.kind, pantryItemId: target.item.id, name: target.item.name, quantity: target.item.quantity, unit: target.item.unit },
      warnings: warningsFor(canonical.name, allergyTerms, dislikedTerms),
      flags,
    };
  });
}
