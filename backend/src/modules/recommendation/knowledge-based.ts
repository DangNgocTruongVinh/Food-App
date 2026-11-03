import type { DietType, MealType } from "@prisma/client";
import { prefersDiet } from "../../services/dietary.service.js";
import { calculateNutritionTargets } from "../../services/nutrition.service.js";
import { groupPantryByName, pantryMatchesFor } from "../../services/pantry-match.js";
import {
  type FitIngredient, type FitPantryItem, matchRecipeToPantry, PANTRY_EXPIRING_WINDOW_DAYS, pantryExpiryState,
} from "../../services/recipe-fit.service.js";
import { type FeatureSpace, similarity } from "./features.js";

// Thuật toán 3 — dựa trên tri thức, tối ưu đa tiêu chí (GĐ3b-R5). Chạy sau lọc cứng (safety.ts). Điểm mềm:
//   s3 = 0,35·f_hạn + 0,25·f_kho + 0,20·f_dd + 0,10·f_dạng + 0,10·f_ưu,  mỗi f ∈ [0, 1]
//   f_hạn  = min(1, Σ_{p ∈ E(r)} (D + 1 − d_p)/(D + 1)),  E(r) = thực phẩm còn hạn ≤ D = 3 ngày mà món dùng, d_p = số ngày còn
//   f_kho  = |nguyên liệu bắt buộc có trong kho (còn hạn)| / |nguyên liệu bắt buộc|
//   f_dd   = 0,6·exp(−½·((kcal − E*)/(0,35·E*))²) + 0,4·min(1, đạm/P*)   (E*, P*: calo/đạm mục tiêu của bữa này)
//   f_dạng = 1 − max_{s ∈ món đã ăn/xếp 3 ngày qua} cos(v_r, v_s)    (vector của thuật toán 1)
//   f_ưu   = 1 nếu món mang nhãn Ít tinh bột/Giàu đạm đúng chế độ của hồ sơ (prefersDiet)
// Khớp kho dùng lại matchRecipeToPantry/pantryExpiryState/pantry-match (cùng quy tắc với "Dành cho bạn" và trừ kho).

export const KNOWLEDGE_WEIGHTS = { expiring: 0.35, pantry: 0.25, nutrition: 0.2, diversity: 0.1, preference: 0.1 } as const;
export type KnowledgePart = keyof typeof KNOWLEDGE_WEIGHTS;
export const KNOWLEDGE_PARTS = Object.keys(KNOWLEDGE_WEIGHTS) as KnowledgePart[];
/** Tỷ lệ calo của từng bữa khi chưa biết hôm nay đã ăn gì. */
export const MEAL_SHARE: Record<MealType, number> = { BREAKFAST: 0.25, LUNCH: 0.35, DINNER: 0.3, SNACK: 0.1 };
export const CALORIE_SIGMA = 0.35;
export const RECENT_DAYS = 3;
const DAY_MS = 86_400_000;

export type KnowledgeRecipe = {
  id: string;
  calories: number;
  proteinG: number;
  dietTags: DietType[];
  ingredients: FitIngredient[];
};
export type MealTarget = { calories: number; proteinG: number };
export type KnowledgeContext = {
  pantry: FitPantryItem[];
  dietType?: DietType | null;
  target: MealTarget;
  /** Món đã ăn hoặc đã xếp trong 3 ngày qua (cho f_dạng). */
  recentRecipeIds: string[];
  space: FeatureSpace;
  now: Date;
  /** Bảng kho theo tên dựng sẵn một lần cho cả lượt gợi ý. */
  pantryIndex?: PantryIndex;
};

const startOfUtcDay = (value: Date) => Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
/** Số ngày còn tới hạn (theo ngày, cùng cách tính với pantryExpiryState). */
const daysLeft = (expiryDate: Date, now: Date) => Math.round((startOfUtcDay(expiryDate) - startOfUtcDay(now)) / DAY_MS);

/** f_hạn và tên các thực phẩm sắp hết hạn món dùng (mỗi thực phẩm tính một lần, theo món hạn sớm nhất). */
type PantryIndex = ReturnType<typeof groupPantryByName<FitPantryItem>>;

export function expiringFeature(
  recipe: Pick<KnowledgeRecipe, "ingredients">, pantry: FitPantryItem[], now: Date, byName: PantryIndex = groupPantryByName(pantry),
) {
  const used = new Map<string, number>();
  for (const ingredient of recipe.ingredients) {
    for (const item of pantryMatchesFor(byName, ingredient.name)) {
      if (!item.expiryDate || pantryExpiryState(item.expiryDate, now) !== "expiring") continue;
      const days = daysLeft(item.expiryDate, now);
      used.set(item.name, Math.min(used.get(item.name) ?? Infinity, days));
    }
  }
  const window = PANTRY_EXPIRING_WINDOW_DAYS + 1;
  const sum = [...used.values()].reduce((total, days) => total + (window - days) / window, 0);
  return { value: Math.min(1, sum), names: [...used].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([name]) => name) };
}

/** f_kho: tỷ lệ nguyên liệu bắt buộc có trong kho (còn hạn). Món không có nguyên liệu bắt buộc → 0. */
export function pantryFeature(
  recipe: Pick<KnowledgeRecipe, "ingredients">, pantry: FitPantryItem[], now: Date, byName: PantryIndex = groupPantryByName(pantry),
) {
  const required = recipe.ingredients.filter((ingredient) => !ingredient.optional);
  const inPantry = required.length ? matchRecipeToPantry({ ingredients: required }, pantry, now, byName).inPantry.length : 0;
  return { value: required.length ? inPantry / required.length : 0, inPantry, required: required.length };
}

/** f_dd: Gaussian quanh calo mục tiêu của bữa (σ = 35% mục tiêu) + mức đạm so với đạm mục tiêu của bữa. */
export function nutritionFeature(recipe: Pick<KnowledgeRecipe, "calories" | "proteinG">, target: MealTarget) {
  const calories = target.calories > 0
    ? Math.exp(-0.5 * ((recipe.calories - target.calories) / (CALORIE_SIGMA * target.calories)) ** 2)
    : 0;
  const protein = target.proteinG > 0 ? Math.min(1, recipe.proteinG / target.proteinG) : 1;
  return 0.6 * calories + 0.4 * protein;
}

/** f_dạng: 1 − độ giống lớn nhất với món gần đây (chưa ăn gì gần đây → 1). */
export function diversityFeature(recipeId: string, recentRecipeIds: string[], space: FeatureSpace) {
  const vector = space.vectors.get(recipeId);
  if (!vector) return 1;
  let max = 0;
  for (const recentId of recentRecipeIds) {
    if (recentId === recipeId) return 0;
    const other = space.vectors.get(recentId);
    if (other) max = Math.max(max, similarity(vector, other).score);
  }
  return Math.max(0, Math.min(1, 1 - max));
}

export type KnowledgeScore = {
  recipeId: string;
  score: number;
  /** α_k·f_k của từng tiêu chí (cộng lại = score). */
  parts: Record<KnowledgePart, number>;
  expiringNames: string[];
  pantryCount: number;
  requiredCount: number;
};

export function knowledgeScore(recipe: KnowledgeRecipe, context: KnowledgeContext): KnowledgeScore {
  const index = context.pantryIndex ?? groupPantryByName(context.pantry);
  const expiring = expiringFeature(recipe, context.pantry, context.now, index);
  const pantry = pantryFeature(recipe, context.pantry, context.now, index);
  const features: Record<KnowledgePart, number> = {
    expiring: expiring.value,
    pantry: pantry.value,
    nutrition: nutritionFeature(recipe, context.target),
    diversity: diversityFeature(recipe.id, context.recentRecipeIds, context.space),
    preference: context.dietType && prefersDiet(recipe, context.dietType) ? 1 : 0,
  };
  const parts = {} as Record<KnowledgePart, number>;
  let score = 0;
  for (const part of KNOWLEDGE_PARTS) {
    parts[part] = KNOWLEDGE_WEIGHTS[part] * features[part];
    score += parts[part];
  }
  return { recipeId: recipe.id, score, parts, expiringNames: expiring.names, pantryCount: pantry.inPantry, requiredCount: pantry.required };
}

/** Lọc thêm cho "Gợi ý món cho thực phẩm X": món phải dùng đúng thực phẩm đó (khớp tên như kho). */
export function usesPantryItem(recipe: Pick<KnowledgeRecipe, "ingredients">, item: FitPantryItem) {
  const byName = groupPantryByName([{ ...item, quantity: Math.max(item.quantity, 1) }]);
  return recipe.ingredients.some((ingredient) => pantryMatchesFor(byName, ingredient.name).length > 0);
}

export type TargetProfile = {
  mealsPerDay?: number | null;
  dailyCalorieTarget?: number | null;
  proteinTargetG?: number | null;
} & Parameters<typeof calculateNutritionTargets>[0];

/**
 * E*, P*: hôm nay đã ăn ít nhất một bữa → (mục tiêu ngày − đã ăn) / số bữa còn lại; chưa → mục tiêu ngày × tỷ lệ bữa
 * (không rõ bữa → chia đều theo số bữa của hồ sơ). Không có hồ sơ → tính theo calculateNutritionTargets mặc định.
 */
export function mealTarget(
  profile: TargetProfile | null | undefined, mealType: MealType | undefined, today: { calories: number; proteinG: number; meals: number },
): MealTarget {
  const computed = calculateNutritionTargets(profile ?? {});
  const daily = { calories: profile?.dailyCalorieTarget ?? computed.calories, proteinG: profile?.proteinTargetG ?? computed.proteinG };
  const meals = Math.max(1, profile?.mealsPerDay ?? 3);
  if (today.meals > 0) {
    const remaining = Math.max(1, meals - today.meals);
    return {
      calories: Math.max(0, daily.calories - today.calories) / remaining,
      proteinG: Math.max(0, daily.proteinG - today.proteinG) / remaining,
    };
  }
  const share = mealType ? MEAL_SHARE[mealType] : 1 / meals;
  return { calories: daily.calories * share, proteinG: daily.proteinG * share };
}

export const recentWindowStart = (now: Date) => new Date(now.getTime() - RECENT_DAYS * DAY_MS);
