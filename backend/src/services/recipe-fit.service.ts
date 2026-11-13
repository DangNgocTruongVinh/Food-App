import type { DietType, FoodUnit } from "@prisma/client";
import { allergenLabels, expandRestrictedTerms, findRestrictedTerms, matchesRequiredDiet, withoutNestedTerms } from "./dietary.service.js";
import { calculateNutritionTargets } from "./nutrition.service.js";
import { groupPantryByName, pantryMatchesFor } from "./pantry-match.js";

// Mức độ phù hợp của một công thức với người dùng (không truy cập DB): dùng cho khối "Dành cho bạn"
// ở trang chi tiết công thức và cho bộ gợi ý (modules/recommendation).

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
export function matchRecipeToPantry(
  recipe: Pick<FitRecipe, "ingredients">, pantry: FitPantryItem[], now = new Date(),
  /** Bảng kho theo tên dựng sẵn (bộ gợi ý so nhiều món với cùng một kho). */
  byName = groupPantryByName(pantry),
) {

  const inPantry: string[] = [];
  const missing: Array<{ name: string; optional: boolean }> = [];
  const expiring: string[] = [];
  const expired: string[] = [];
  const unitMismatches: Array<{ name: string; recipeUnit: FoodUnit; pantryUnits: FoodUnit[] }> = [];

  for (const ingredient of recipe.ingredients) {
    const matches = pantryMatchesFor(byName, ingredient.name);
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


/** Cảnh báo theo hồ sơ: thành phần gây dị ứng (theo nhóm), món không thích, không hợp chế độ chay/thuần chay. */
export function recipeWarnings(
  recipe: Pick<FitRecipe, "name" | "dietTags"> & { ingredients: Array<{ name: string }> },
  profile: Pick<FitProfile, "dietType" | "allergies" | "dislikedFoods"> | null | undefined,
) {
  const dietType = profile?.dietType ?? "BALANCED";
  return {
    // Dị ứng theo nhóm: nhãn "nhóm (nguyên liệu)" để giao diện ghi "Chứa: Trứng (Trứng gà)". Kiểm nhanh trước, chỉ dựng nhãn khi vi phạm.
    allergens: findRestrictedTerms(recipe, expandRestrictedTerms(profile?.allergies ?? [])).length
      ? allergenLabels(recipe, profile?.allergies ?? [])
      : [],
    dislikedFoods: withoutNestedTerms(findRestrictedTerms(recipe, expandRestrictedTerms(profile?.dislikedFoods ?? [], { strict: false }))),
    dietConflict: matchesRequiredDiet(recipe, dietType) ? null : dietType,
  };
}
