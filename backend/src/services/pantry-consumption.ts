import type { FoodUnit } from "@prisma/client";
import { canConvertUnit, convertQuantity, roundQuantity } from "../utils/food-units.js";
import { groupPantryByName, pantryMatchesFor } from "./pantry-match.js";
import { pantryExpiryState } from "./recipe-fit.service.js";

// "Đã ăn" → trừ kho (GĐ3b): phần tính toán thuần, không truy cập DB. Đọc/ghi DB ở modules/meal-plans/meal-consumption.service.ts.

export type ConsumptionIngredient = { id: string; name: string; quantity: number; unit: FoodUnit; optional: boolean };
export type ConsumptionPantryItem = { id: string; name: string; quantity: number; unit: FoodUnit; expiryDate: Date | null; createdAt?: Date };

/**
 * ENOUGH: đủ; SHORT: thiếu (trừ hết phần đang có); NOT_IN_PANTRY: kho không có thực phẩm cùng tên còn số lượng;
 * UNIT_MISMATCH: có nhưng đơn vị không quy đổi được (vd. kho "cái", công thức "g"); EXPIRED_ONLY: chỉ còn món đã hết hạn
 * (mặc định không trừ); OPTIONAL: nguyên liệu tùy chọn (mặc định không trừ, người dùng có thể chọn trừ).
 */
export type ConsumptionStatus = "ENOUGH" | "SHORT" | "NOT_IN_PANTRY" | "UNIT_MISMATCH" | "EXPIRED_ONLY" | "OPTIONAL";

export type Deduction = {
  pantryItemId: string;
  name: string;
  /** Lượng trừ theo đơn vị của thực phẩm trong kho. */
  quantity: number;
  unit: FoodUnit;
  expiryDate: Date | null;
  quantityAfter: number;
};

export type ConsumptionLine = {
  ingredientId: string;
  name: string;
  optional: boolean;
  /** Lượng cần cho bữa này (theo đơn vị của công thức). */
  required: { quantity: number; unit: FoodUnit };
  status: ConsumptionStatus;
  /** Trừ bao nhiêu từ thực phẩm nào (theo hạn sớm nhất trước) nếu trừ dòng này. */
  deductions: Deduction[];
  /** Phần còn thiếu theo đơn vị của công thức (0 nếu đủ). */
  shortfall: number;
  /** Lượng client nên gửi mặc định khi xác nhận: 0 với dòng tùy chọn, hết hạn, không có, khác đơn vị. */
  defaultQuantity: number;
  /** Đơn vị của thực phẩm cùng tên không quy đổi được (để giao diện nói rõ). */
  otherUnits: FoodUnit[];
};

/** Lượng cần cho một bữa: định lượng công thức tính cho `recipe.servings` khẩu phần, bữa ăn `item.servings` khẩu phần. */
export function requiredQuantity(ingredientQuantity: number, itemServings: number, recipeServings: number) {
  return roundQuantity((ingredientQuantity * itemServings) / Math.max(1, recipeServings));
}

const expirySortKey = (item: ConsumptionPantryItem) => item.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;

/** Hạn sớm nhất trước, thực phẩm không có hạn sau cùng; cùng hạn thì món nhập trước dùng trước. */
export function byExpiryFirst(a: ConsumptionPantryItem, b: ConsumptionPantryItem) {
  return expirySortKey(a) - expirySortKey(b) || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || a.id.localeCompare(b.id);
}

/**
 * Phân bổ `quantity` (đơn vị `unit`) vào các thực phẩm dùng được theo hạn sớm nhất trước, không trừ quá số đang có.
 * `available` theo dõi số còn lại của từng thực phẩm để nhiều nguyên liệu cùng tên (hiếm) không trừ trùng.
 */
function allocate(quantity: number, unit: FoodUnit, items: ConsumptionPantryItem[], available: Map<string, number>) {
  const deductions: Deduction[] = [];
  let remaining = quantity;
  for (const item of items) {
    if (remaining <= 0) break;
    const left = available.get(item.id) ?? item.quantity;
    const leftInUnit = convertQuantity(left, item.unit, unit);
    if (leftInUnit === null || leftInUnit <= 0) continue;
    const takeInUnit = Math.min(leftInUnit, remaining);
    const take = Math.min(left, convertQuantity(takeInUnit, unit, item.unit) ?? 0);
    if (take <= 0) continue;
    const after = roundQuantity(left - take);
    available.set(item.id, after);
    remaining = roundQuantity(remaining - takeInUnit);
    deductions.push({ pantryItemId: item.id, name: item.name, quantity: roundQuantity(take), unit: item.unit, expiryDate: item.expiryDate, quantityAfter: after });
  }
  return { deductions, shortfall: Math.max(0, roundQuantity(remaining)) };
}

/**
 * Xem trước trừ kho cho một bữa: mỗi nguyên liệu một dòng. `amounts` (theo ingredientId) thay lượng cần khi người dùng
 * đã sửa (dùng lúc xác nhận); khi có `amounts`, dòng tùy chọn được trừ như dòng thường.
 */
export function planConsumption(
  ingredients: ConsumptionIngredient[],
  itemServings: number,
  recipeServings: number,
  pantry: ConsumptionPantryItem[],
  now = new Date(),
  amounts?: Map<string, { quantity: number; unit: FoodUnit }>,
): ConsumptionLine[] {
  const byName = groupPantryByName(pantry);
  const available = new Map<string, number>();
  return ingredients.map((ingredient) => {
    const override = amounts?.get(ingredient.id);
    const required = override ?? { quantity: requiredQuantity(ingredient.quantity, itemServings, recipeServings), unit: ingredient.unit };
    const matches = pantryMatchesFor(byName, ingredient.name);
    const usable = matches.filter((item) => pantryExpiryState(item.expiryDate, now) !== "expired");
    const convertible = usable.filter((item) => canConvertUnit(item.unit, required.unit)).sort(byExpiryFirst);
    const otherUnits = [...new Set(usable.filter((item) => !canConvertUnit(item.unit, required.unit)).map((item) => item.unit))];
    const base = { ingredientId: ingredient.id, name: ingredient.name, optional: ingredient.optional, required, otherUnits };

    if (!matches.length) return { ...base, status: "NOT_IN_PANTRY", deductions: [], shortfall: required.quantity, defaultQuantity: 0 };
    if (!usable.length) {
      // Chỉ còn món đã hết hạn: xem trước thì mặc định không trừ; người dùng chủ động chọn trừ (amounts) thì trừ từ các món đó.
      const expired = matches.filter((item) => canConvertUnit(item.unit, required.unit)).sort(byExpiryFirst);
      if (!override || !expired.length) return { ...base, status: "EXPIRED_ONLY", deductions: [], shortfall: required.quantity, defaultQuantity: 0 };
      const { deductions, shortfall } = allocate(required.quantity, required.unit, expired, available);
      return { ...base, status: "EXPIRED_ONLY", deductions, shortfall, defaultQuantity: roundQuantity(required.quantity - shortfall) };
    }
    if (!convertible.length) return { ...base, status: "UNIT_MISMATCH", deductions: [], shortfall: required.quantity, defaultQuantity: 0 };

    // Dòng tùy chọn mặc định không trừ: xem trước trên bản sao để không giữ chỗ phần kho của các dòng sau.
    const isDefaultOptional = ingredient.optional && !override;
    const { deductions, shortfall } = allocate(required.quantity, required.unit, convertible, isDefaultOptional ? new Map(available) : available);
    const status: ConsumptionStatus = isDefaultOptional ? "OPTIONAL" : shortfall > 0 ? "SHORT" : "ENOUGH";
    const deducted = roundQuantity(required.quantity - shortfall);
    return { ...base, status, deductions, shortfall, defaultQuantity: status === "OPTIONAL" ? 0 : deducted };
  });
}
