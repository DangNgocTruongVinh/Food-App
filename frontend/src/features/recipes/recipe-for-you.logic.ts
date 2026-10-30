import type { RecipeForYou } from "../../types";

// Nội dung hiển thị của khối "Dành cho bạn" ở trang chi tiết công thức (dữ liệu từ GET /api/recipes/:id/for-you).

const dietConflictLabels: Record<string, string> = { VEGETARIAN: "Ăn chay", VEGAN: "Thuần chay" };
const numberFormat = new Intl.NumberFormat("vi-VN");

export function pantryCoverage(pantry: RecipeForYou["pantry"]) {
  const percent = pantry.totalIngredients ? Math.round((pantry.inPantryCount / pantry.totalIngredients) * 100) : 0;
  return { label: `${pantry.inPantryCount}/${pantry.totalIngredients}`, percent };
}

/** Nguyên liệu bắt buộc đứng trước nguyên liệu tùy chọn; ghi chú nếu kho có món đó nhưng đã hết hạn. */
export function missingIngredientItems(pantry: Pick<RecipeForYou["pantry"], "missing" | "expired">) {
  const expired = new Set(pantry.expired);
  return [...pantry.missing]
    .sort((a, b) => Number(a.optional) - Number(b.optional))
    .map(({ name, optional }) => ({
      name,
      note: [optional ? "tùy chọn" : "", expired.has(name) ? "trong kho đã hết hạn" : ""].filter(Boolean).join(", "),
    }));
}

export function expiringHint(expiring: string[]) {
  if (!expiring.length) return null;
  return `${expiring.join(", ")} trong kho sắp hết hạn. Nên nấu món này sớm.`;
}

export function unitMismatchNote(unitMismatches: RecipeForYou["pantry"]["unitMismatches"]) {
  if (!unitMismatches.length) return null;
  const names = unitMismatches.map((item) => item.name).join(", ");
  return `Chỉ so theo tên nguyên liệu, chưa so được số lượng (khác đơn vị: ${names}).`;
}

export function calorieShareLabel(calories: RecipeForYou["calories"]) {
  return `${numberFormat.format(calories.recipeCalories)} / ${numberFormat.format(calories.dailyTarget)} kcal mục tiêu ngày`;
}

export function forYouWarnings(warnings: RecipeForYou["warnings"]) {
  const items: Array<{ kind: "allergen" | "disliked" | "diet"; text: string }> = [];
  if (warnings.allergens.length) items.push({ kind: "allergen", text: `Có thành phần bạn dị ứng: ${warnings.allergens.join(", ")}` });
  if (warnings.dislikedFoods.length) items.push({ kind: "disliked", text: `Có món bạn không thích: ${warnings.dislikedFoods.join(", ")}` });
  if (warnings.dietConflict) {
    items.push({ kind: "diet", text: `Không hợp chế độ ${dietConflictLabels[warnings.dietConflict] ?? warnings.dietConflict} của bạn` });
  }
  return items;
}
