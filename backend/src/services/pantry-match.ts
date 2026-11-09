import { normalizeFoodText } from "./dietary.service.js";

// Khớp nguyên liệu của công thức với thực phẩm trong kho theo tên đã chuẩn hóa (không phân biệt hoa thường, khoảng trắng
// thừa; giữ dấu tiếng Việt). Dùng chung cho "Dành cho bạn"/gợi ý (recipe-fit.service.ts) và trừ kho (pantry-consumption.ts).

/** Gom thực phẩm còn số lượng (> 0) theo tên đã chuẩn hóa. Thực phẩm đã dùng hết (= 0) không khớp với nguyên liệu nào. */
export function groupPantryByName<T extends { name: string; quantity: number }>(items: T[]) {
  const byName = new Map<string, T[]>();
  for (const item of items) {
    if (item.quantity <= 0) continue;
    const key = normalizeFoodText(item.name);
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }
  return byName;
}

/** Thực phẩm cùng tên với nguyên liệu (rỗng nếu kho không có). */
export function pantryMatchesFor<T>(byName: Map<string, T[]>, ingredientName: string) {
  return byName.get(normalizeFoodText(ingredientName)) ?? [];
}
