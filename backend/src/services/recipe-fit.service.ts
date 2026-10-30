import type { DietType, FoodUnit } from "@prisma/client";
import { expandRestrictedTerms, filterRecipesForProfile, findRestrictedTerms, matchesRequiredDiet, normalizeFoodText } from "./dietary.service.js";
import { calculateNutritionTargets } from "./nutrition.service.js";

// Mức độ phù hợp của một công thức với người dùng (không truy cập DB): dùng cho khối "Dành cho bạn"
// ở trang chi tiết công thức và cho gợi ý ở Dashboard.

const DAY_MS = 86_400_000;
/** Cùng ngưỡng với cảnh báo PANTRY_EXPIRING: hạn dùng trong khoảng hôm nay → 3 ngày tới (theo ngày UTC). */
export const PANTRY_EXPIRING_WINDOW_DAYS = 3;

export type FitIngredient = { name: string; quantity: number; unit: FoodUnit; optional?: boolean };
export type FitRecipe = { name: string; calories: number; dietTags: DietType[]; ingredients: FitIngredient[] };
export type FitPantryItem = { name: string; quantity: number; unit: FoodUnit; expiryDate: Date | null };
export type FitProfile = {
  dietType?: DietType | null;
  allergies?: string[];
  dislikedFoods?: string[];
  dailyCalorieTarget?: number | null;
} & Parameters<typeof calculateNutritionTargets>[0];

const startOfUtcDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

export function pantryExpiryState(expiryDate: Date | null, now = new Date()): "expired" | "expiring" | "fresh" {
  if (!expiryDate) return "fresh";
  const today = startOfUtcDay(now);
  const expiryDay = startOfUtcDay(expiryDate);
  if (expiryDay < today) return "expired";
  return expiryDay.getTime() <= today.getTime() + PANTRY_EXPIRING_WINDOW_DAYS * DAY_MS ? "expiring" : "fresh";
}

/**
 * So nguyên liệu của công thức với kho theo có/không (tên đã chuẩn hóa), không so số lượng.
 * Món trong kho đã hết hạn không được tính là "có". Khi kho có nguyên liệu nhưng khác đơn vị (vd. công thức "g",
 * kho "cái") vẫn tính là có, nhưng ghi vào unitMismatches để giao diện nói rõ không so được số lượng.
 */
export function matchRecipeToPantry(recipe: Pick<FitRecipe, "ingredients">, pantry: FitPantryItem[], now = new Date()) {
  const byName = new Map<string, FitPantryItem[]>();
  for (const item of pantry) {
    if (item.quantity <= 0) continue;
    const key = normalizeFoodText(item.name);
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }

  const inPantry: string[] = [];
  const missing: Array<{ name: string; optional: boolean }> = [];
  const expiring: string[] = [];
  const expired: string[] = [];
  const unitMismatches: Array<{ name: string; recipeUnit: FoodUnit; pantryUnits: FoodUnit[] }> = [];

  for (const ingredient of recipe.ingredients) {
    const matches = byName.get(normalizeFoodText(ingredient.name)) ?? [];
    const usable = matches.filter((item) => pantryExpiryState(item.expiryDate, now) !== "expired");
    if (!usable.length) {
      missing.push({ name: ingredient.name, optional: Boolean(ingredient.optional) });
      if (matches.length) expired.push(ingredient.name);
      continue;
    }
    inPantry.push(ingredient.name);
    if (usable.some((item) => pantryExpiryState(item.expiryDate, now) === "expiring")) expiring.push(ingredient.name);
    if (!usable.some((item) => item.unit === ingredient.unit)) {
      unitMismatches.push({ name: ingredient.name, recipeUnit: ingredient.unit, pantryUnits: [...new Set(usable.map((item) => item.unit))] });
    }
  }

  return { totalIngredients: recipe.ingredients.length, inPantry, missing, expiring, expired, unitMismatches };
}

/** Phần trăm calo của một khẩu phần so với mục tiêu ngày (mục tiêu lưu trong hồ sơ, hoặc tính từ hồ sơ). */
export function calorieShare(recipeCalories: number, profile: FitProfile | null | undefined) {
  const dailyTarget = profile?.dailyCalorieTarget ?? calculateNutritionTargets(profile ?? {}).calories;
  return { recipeCalories, dailyTarget, percentOfDailyTarget: Math.round((recipeCalories / Math.max(1, dailyTarget)) * 100) };
}

/** Bỏ cụm từ đã nằm trong một cụm khác cũng khớp (vd. "mắm" khi đã có "nước mắm") để cảnh báo không lặp. */
const withoutNestedTerms = (terms: string[]) =>
  terms.filter((term) => !terms.some((other) => other !== term && ` ${other} `.includes(` ${term} `)));

/** Cảnh báo theo hồ sơ: thành phần gây dị ứng (theo nhóm), món không thích, không hợp chế độ chay/thuần chay. */
export function recipeWarnings(recipe: Pick<FitRecipe, "name" | "dietTags" | "ingredients">, profile: FitProfile | null | undefined) {
  const dietType = profile?.dietType ?? "BALANCED";
  return {
    allergens: withoutNestedTerms(findRestrictedTerms(recipe, expandRestrictedTerms(profile?.allergies ?? []))),
    dislikedFoods: withoutNestedTerms(findRestrictedTerms(recipe, expandRestrictedTerms(profile?.dislikedFoods ?? []))),
    dietConflict: matchesRequiredDiet(recipe, dietType) ? null : dietType,
  };
}

/**
 * Gợi ý món cho Dashboard: chỉ món hợp chế độ ăn, không chứa dị ứng/món không thích; ưu tiên món dùng nguyên liệu
 * sắp hết hạn, rồi món dùng nhiều nguyên liệu trong kho. Hòa nhau thì giữ thứ tự đầu vào (sort ổn định).
 */
export function recommendRecipes<T extends FitRecipe>(
  recipes: T[],
  profile: FitProfile | null | undefined,
  pantry: FitPantryItem[],
  limit = 3,
  now = new Date(),
) {
  return filterRecipesForProfile(recipes, profile)
    .map((recipe) => {
      const match = matchRecipeToPantry(recipe, pantry, now);
      return {
        recipe,
        totalIngredients: match.totalIngredients,
        pantryIngredientCount: match.inPantry.length,
        expiringIngredientCount: match.expiring.length,
      };
    })
    .sort((a, b) => b.expiringIngredientCount - a.expiringIngredientCount || b.pantryIngredientCount - a.pantryIngredientCount)
    .slice(0, limit);
}
