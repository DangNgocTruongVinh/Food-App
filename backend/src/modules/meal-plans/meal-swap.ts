import type { FoodUnit, MealType, Prisma } from "@prisma/client";
import { foodCategoryOf } from "../../services/food-category.js";
import { normalizeFoodText } from "../../services/dietary.service.js";
import { requiredQuantity } from "../../services/pantry-consumption.js";
import { safeRecipes, type SafetyProfile, type SafetyRecipe } from "../recommendation/safety.js";

// "Đổi món" một bữa trong thực đơn đã tạo (GĐ3b-R2): chọn món thay và tính phần thay đổi của danh sách đi chợ
// (thuần, không truy cập DB; riêng `applyShoppingChanges` ghi qua transaction được truyền vào). Dùng khi người dùng thêm dị ứng/đổi chế độ ăn sau khi tạo thực đơn.

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

/** Ghi các thay đổi danh sách đi chợ trong transaction đang mở; chỉ đụng dòng chưa mua. */
export async function applyShoppingChanges(tx: Prisma.TransactionClient, mealPlanId: string, changes: ShoppingChange[]) {
  for (const change of changes) {
    if (change.kind === "update") {
      await tx.shoppingItem.updateMany({ where: { id: change.id, purchased: false }, data: { quantity: change.quantity } });
    } else if (change.kind === "delete") {
      await tx.shoppingItem.deleteMany({ where: { id: change.id, purchased: false } });
    } else {
      await tx.shoppingItem.create({ data: { mealPlanId, name: change.name, quantity: change.quantity, unit: change.unit, category: foodCategoryOf(change.name) } });
    }
  }
}

export type MealShare = { recipe: Pick<SwapRecipe, "servings" | "ingredients">; servings: number };

/**
 * Điều chỉnh danh sách đi chợ theo phần của một bữa (ước lượng, không tính lại cả tuần nên bữa đã ăn không bao giờ
 * quay lại danh sách): bữa bị bỏ (`removed`) làm dòng chưa mua giảm đúng lượng của bữa (về 0 thì xóa); bữa được thêm
 * (`added`) cộng vào dòng chưa mua cùng tên + đơn vị, chưa có dòng thì tạo dòng phần còn thiếu so với kho hiện tại.
 * Dòng đã mua giữ nguyên (đã vào kho, có lịch sử kho). Dùng cho đổi món (bỏ + thêm), thêm món, xóa món.
 */
export function shoppingChangesForMeal(
  change: { removed?: MealShare; added?: MealShare },
  shopping: ShoppingLine[],
  pantry: PantryLine[],
): ShoppingChange[] {
  const open = new Map(shopping.filter((line) => !line.purchased).map((line) => [keyOf(line.name, line.unit), { ...line }]));
  const touched = new Set<string>();
  const removed = change.removed ? mealNeeds(change.removed.recipe, change.removed.servings) : new Map() as ReturnType<typeof mealNeeds>;
  for (const [key, need] of removed) {
    const line = open.get(key);
    if (!line) continue;
    line.quantity = round1(line.quantity - need.quantity);
    touched.add(key);
  }
  const created: ShoppingChange[] = [];
  const pantryByKey = new Map<string, number>();
  pantry.forEach((item) => pantryByKey.set(keyOf(item.name, item.unit), (pantryByKey.get(keyOf(item.name, item.unit)) ?? 0) + item.quantity));
  const added = change.added ? mealNeeds(change.added.recipe, change.added.servings) : new Map() as ReturnType<typeof mealNeeds>;
  for (const [key, need] of added) {
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

/** Đổi món: bỏ phần của món cũ, thêm phần của món mới, cùng khẩu phần của bữa. */
export const shoppingChangesForSwap = (
  oldRecipe: MealShare["recipe"], newRecipe: MealShare["recipe"], servings: number, shopping: ShoppingLine[], pantry: PantryLine[],
) => shoppingChangesForMeal({ removed: { recipe: oldRecipe, servings }, added: { recipe: newRecipe, servings } }, shopping, pantry);
