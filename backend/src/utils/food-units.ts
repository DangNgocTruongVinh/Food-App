import type { FoodUnit } from "@prisma/client";

// Đơn vị cùng nhóm quy đổi được qua đơn vị gốc (g, ml). "Cái" và "gói" không quy đổi sang khối lượng/thể tích.
const UNIT_BASE: Record<FoodUnit, { dimension: "mass" | "volume" | "item" | "package"; factor: number }> = {
  G: { dimension: "mass", factor: 1 },
  KG: { dimension: "mass", factor: 1000 },
  ML: { dimension: "volume", factor: 1 },
  L: { dimension: "volume", factor: 1000 },
  ITEM: { dimension: "item", factor: 1 },
  PACKAGE: { dimension: "package", factor: 1 },
};

/** Làm tròn 3 chữ số thập phân để tránh sai số dấu phẩy động (0,1 + 0,2) khi cộng trừ kho. */
export function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function canConvertUnit(from: FoodUnit, to: FoodUnit) {
  return UNIT_BASE[from].dimension === UNIT_BASE[to].dimension;
}

/** Quy đổi số lượng giữa hai đơn vị cùng nhóm (g ↔ kg, ml ↔ l); khác nhóm thì trả null. */
export function convertQuantity(quantity: number, from: FoodUnit, to: FoodUnit) {
  if (!canConvertUnit(from, to)) return null;
  return roundQuantity((quantity * UNIT_BASE[from].factor) / UNIT_BASE[to].factor);
}
