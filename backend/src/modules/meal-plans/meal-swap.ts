import type { FoodUnit, MealType } from "@prisma/client";
import { normalizeFoodText } from "../../services/dietary.service.js";
import { requiredQuantity } from "../../services/pantry-consumption.js";
import { safeRecipes, type SafetyProfile, type SafetyRecipe } from "../recommendation/safety.js";

// "Đổi món" một bữa trong thực đơn đã tạo (GĐ3b-R2), không truy cập DB: chọn món thay và tính phần thay đổi
// của danh sách đi chợ. Dùng khi người dùng thêm dị ứng/đổi chế độ ăn sau khi tạo thực đơn.

export type SwapRecipe = SafetyRecipe & {
  id: string;
  calories: number;
  servings: number;
  ingredients: Array<{ name: string; quantity: number; unit: FoodUnit }>;
};

// Mỗi lần món đã có trong thực đơn tính như lệch 100 kcal: ưu tiên món ít lặp, rồi món có calo gần món cũ.
const WEEKLY_USE_KCAL = 100;

/**
 * Món thay: qua lọc an toàn (dị ứng, không thích, chay/thuần chay, món ẩn, đúng bữa), khác món cũ, không trùng món
 * khác trong cùng ngày (trừ khi không còn món nào), chi phí = |calo − calo món cũ| + 100 × số lần đã có trong thực đơn.
 * Hòa thì theo tên để kết quả ổn định. Không có món nào → null.
 */
export function pickSwapRecipe<T extends SwapRecipe>(
  recipes: T[],
  profile: SafetyProfile,
  current: { recipeId: string; calories: number; mealType: MealType },
  usage: { sameDay: Set<string>; planCounts: Map<string, number> },
): T | null {
  const candidates = safeRecipes(recipes, profile, { mealType: current.mealType }).filter((recipe) => recipe.id !== current.recipeId);
  const notToday = candidates.filter((recipe) => !usage.sameDay.has(recipe.id));
  const choices = notToday.length ? notToday : candidates;
  const cost = (recipe: T) => Math.abs(recipe.calories - current.calories) + (usage.planCounts.get(recipe.id) ?? 0) * WEEKLY_USE_KCAL;
  return [...choices].sort((a, b) => cost(a) - cost(b) || a.name.localeCompare(b.name, "vi"))[0] ?? null;
}

export type ShoppingLine = { id: string; name: string; quantity: number; unit: FoodUnit; purchased: boolean };
export type PantryLine = { name: string; quantity: number; unit: FoodUnit };
export type ShoppingChange =
  | { kind: "update"; id: string; quantity: number }
  | { kind: "delete"; id: string }
  | { kind: "create"; name: string; quantity: number; unit: FoodUnit };

const keyOf = (name: string, unit: FoodUnit) => `${normalizeFoodText(name)}:${unit}`;
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Lượng nguyên liệu của một bữa (theo khẩu phần của bữa), gộp theo tên đã chuẩn hóa + đơn vị. */
function mealNeeds(recipe: Pick<SwapRecipe, "servings" | "ingredients">, servings: number) {
  const needs = new Map<string, { name: string; quantity: number; unit: FoodUnit }>();
  for (const ingredient of recipe.ingredients) {
    const key = keyOf(ingredient.name, ingredient.unit);
    const quantity = requiredQuantity(ingredient.quantity, servings, recipe.servings) + (needs.get(key)?.quantity ?? 0);
    needs.set(key, { name: ingredient.name, quantity, unit: ingredient.unit });
  }
  return needs;
}

/**
 * Điều chỉnh danh sách đi chợ khi đổi món (ước lượng, không tính lại cả tuần): dòng chưa mua của món cũ giảm đúng
 * lượng của bữa đó (về 0 thì xóa); nguyên liệu món mới cộng vào dòng chưa mua cùng tên + đơn vị, chưa có dòng thì
 * tạo dòng phần còn thiếu so với kho hiện tại. Dòng đã mua giữ nguyên (đã vào kho, có lịch sử kho).
 */
export function shoppingChangesForSwap(
  oldRecipe: Pick<SwapRecipe, "servings" | "ingredients">,
  newRecipe: Pick<SwapRecipe, "servings" | "ingredients">,
  servings: number,
  shopping: ShoppingLine[],
  pantry: PantryLine[],
): ShoppingChange[] {
  const open = new Map(shopping.filter((line) => !line.purchased).map((line) => [keyOf(line.name, line.unit), { ...line }]));
  const touched = new Set<string>();
  for (const [key, need] of mealNeeds(oldRecipe, servings)) {
    const line = open.get(key);
    if (!line) continue;
    line.quantity = round1(line.quantity - need.quantity);
    touched.add(key);
  }
  const created: ShoppingChange[] = [];
  const pantryByKey = new Map<string, number>();
  pantry.forEach((item) => pantryByKey.set(keyOf(item.name, item.unit), (pantryByKey.get(keyOf(item.name, item.unit)) ?? 0) + item.quantity));
  for (const [key, need] of mealNeeds(newRecipe, servings)) {
    const line = open.get(key);
    if (line) {
      line.quantity = round1(Math.max(0, line.quantity) + need.quantity);
      touched.add(key);
      continue;
    }
    const missing = round1(need.quantity - (pantryByKey.get(key) ?? 0));
    if (missing > 0.01) created.push({ kind: "create", name: need.name, quantity: missing, unit: need.unit });
  }
  const changed: ShoppingChange[] = [...touched].map((key) => {
    const line = open.get(key)!;
    return line.quantity > 0.01 ? { kind: "update", id: line.id, quantity: line.quantity } : { kind: "delete", id: line.id };
  });
  return [...changed, ...created];
}
