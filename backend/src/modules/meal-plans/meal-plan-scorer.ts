import type { DietType, FoodUnit, MealType } from "@prisma/client";
import { groupPantryByName } from "../../services/pantry-match.js";
import { type ConsumptionPantryItem, planConsumption } from "../../services/pantry-consumption.js";
import { HttpError } from "../../utils/http-error.js";
import type { GeneratedPlan } from "../ai/ai.service.js";
import { type ContentProfile, contentScores, userVector } from "../recommendation/content-based.js";
import { type FeatureRecipe, getFeatureSpace } from "../recommendation/features.js";
import type { Interaction } from "../recommendation/interactions.js";
import {
  CALORIE_SIGMA, type KnowledgeRecipe, knowledgeScore, mealTarget, RECENT_DAYS, type TargetProfile,
} from "../recommendation/knowledge-based.js";
import { fitsMealType, safeRecipes, type SafetyProfile, type SafetyRecipe } from "../recommendation/safety.js";
import { mealSlots } from "./meal-plan-generator.js";

// Bộ tạo thực đơn 7 ngày khi không có OpenAI (GĐ3b-R8), hàm thuần. Chỉ ghép các hàm có sẵn của bộ gợi ý, không đổi công thức
// hay trọng số của chúng. Với từng bữa, theo thứ tự ngày → bữa:
//   1. ứng viên = lọc an toàn (safety.ts) + đúng bữa;
//   2. bắt buộc khi còn lựa chọn: không lặp trong ngày; không lặp món của REPEAT_WINDOW_DAYS − 1 ngày trước (= không lặp trong 3 ngày);
//      rồi chỉ giữ món có calo trong ±35% (CALORIE_SIGMA, cùng σ với f_dd) mục tiêu bữa E*, nếu có món như vậy;
//   3. điểm = s3 (thuật toán 3, knowledge-based.ts) + 0,3·s1 (thuật toán 1, content-based.ts) − 0,1·(số lần đã xếp trong tuần), với
//      - kho ảo: sau mỗi bữa trừ nguyên liệu như "Đã ăn" (planConsumption, hạn sớm trước, không trừ đồ đã hết hạn), nên một
//        thực phẩm sắp hết hạn chỉ được thưởng (f_hạn, f_kho) khi kho ảo còn, không dùng quá lượng đang có;
//      - `now` = ngày của bữa: đồ đã qua hạn ở ngày đó không được thưởng (chỉ các ngày trước hạn);
//      - E*, P* (mealTarget) tính theo phần còn lại của ngày sau các bữa đã xếp → khớp calo theo bữa và cả ngày;
//      - f_dạng so với món đã ăn/xếp trong 3 ngày gần nhất (kể cả bữa đã xếp hôm nay).

export const CONTENT_WEIGHT = 0.3;
/** Không lặp một món trong cửa sổ 3 ngày liên tiếp (hôm nay và 2 ngày trước), nếu còn món khác. */
export const REPEAT_WINDOW_DAYS = 3;
/** Phạt nhẹ mỗi lần món đã được xếp trong tuần (phân bổ đều; nhỏ hơn hẳn phần thưởng đồ sắp hết hạn 0,35). */
export const WEEKLY_REPEAT_PENALTY = 0.1;
const DAY_MS = 86_400_000;

export type ScorerRecipe = SafetyRecipe & FeatureRecipe & KnowledgeRecipe & {
  id: string;
  servings: number;
  ingredients: Array<{ id: string; name: string; quantity: number; unit: FoodUnit; optional: boolean }>;
};
export type ScorerProfile = (SafetyProfile & ContentProfile & TargetProfile & { dietType?: DietType | null }) | null | undefined;
export type ScorerInput<R extends ScorerRecipe> = {
  /** Món được phép (đã lọc theo hồ sơ ở service); bộ tạo vẫn lọc an toàn lại. */
  recipes: R[];
  /** Bộ món đang hiện, để dựng không gian đặc trưng giống bộ gợi ý (mặc định = recipes). */
  catalog?: FeatureRecipe[];
  profile: ScorerProfile;
  mealsPerDay: number;
  /** Kho còn số lượng (> 0). */
  pantry: ConsumptionPantryItem[];
  /** Lịch sử của người dùng (thuật toán 1; món đã ăn/xếp 3 ngày trước ngày bắt đầu cho f_dạng). */
  history: Interaction[];
  startDate: Date;
  /** Chỉ dùng cho đánh giá (scripts/eval-meal-plan.ts): null = bỏ khoảng calo ở bước 2. */
  calorieWindow?: number | null;
};

const reasonFor = (expiringNames: string[]) => (expiringNames.length
  ? `Dùng thực phẩm sắp hết hạn: ${expiringNames.join(", ")}.`
  : "Hợp mục tiêu năng lượng của bữa, kho thực phẩm và khẩu vị.");

export function scoredPlan<R extends ScorerRecipe>(input: ScorerInput<R>): GeneratedPlan {
  const profile = input.profile ? { ...input.profile, mealsPerDay: input.mealsPerDay } : { mealsPerDay: input.mealsPerDay };
  const allowed = safeRecipes(input.recipes, input.profile);
  if (!allowed.length) throw new HttpError(422, "Chưa có công thức phù hợp để tạo thực đơn.");
  const space = getFeatureSpace(input.catalog ?? input.recipes);
  const content = new Map(contentScores(userVector(input.profile, input.history, space, input.startDate), allowed.map((r) => r.id), space)
    .map((entry) => [entry.recipeId, entry.score]));

  // Món theo ngày tương đối với ngày bắt đầu (âm = trước thực đơn), cho f_dạng và quy tắc không lặp.
  const eatenBefore = input.history
    .filter((entry) => (entry.kind === "EATEN" || entry.kind === "PLANNED") && entry.at < input.startDate)
    .map((entry) => ({ day: Math.floor((entry.at.getTime() - input.startDate.getTime()) / DAY_MS), recipeId: entry.recipeId }))
    .filter((entry) => entry.day >= -RECENT_DAYS);
  const placed: Array<{ day: number; recipeId: string }> = [...eatenBefore];
  const weekCounts = new Map<string, number>();
  let pantry = input.pantry.filter((item) => item.quantity > 0).map((item) => ({ ...item }));

  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const now = new Date(input.startDate.getTime() + dayIndex * DAY_MS);
    const today = { calories: 0, proteinG: 0, meals: 0 };
    const meals = mealSlots(input.mealsPerDay).map((mealType: MealType) => {
      const declared = allowed.filter((recipe) => recipe.mealTypes?.includes(mealType));
      const fitting = allowed.filter((recipe) => fitsMealType(recipe, mealType));
      const pool = declared.length ? declared : fitting.length ? fitting : allowed;
      const usedSince = (fromDay: number) => new Set(placed.filter((entry) => entry.day >= fromDay).map((entry) => entry.recipeId));
      const notToday = pool.filter((recipe) => !usedSince(dayIndex).has(recipe.id));
      const notRecent = notToday.filter((recipe) => !usedSince(dayIndex - REPEAT_WINDOW_DAYS + 1).has(recipe.id));
      const varied = notRecent.length ? notRecent : notToday.length ? notToday : pool;
      const target = mealTarget(profile, mealType, today);
      const window = input.calorieWindow === undefined ? CALORIE_SIGMA : input.calorieWindow;
      const nearTarget = window === null ? [] : varied.filter((recipe) => Math.abs(recipe.calories - target.calories) <= window * target.calories);
      const candidates = nearTarget.length ? nearTarget : varied;

      const context = {
        pantry, pantryIndex: groupPantryByName(pantry), dietType: input.profile?.dietType, now, space, target,
        recentRecipeIds: [...usedSince(dayIndex - RECENT_DAYS)],
      };
      let best: { recipe: R; score: number; expiringNames: string[] } | null = null;
      for (const recipe of candidates) {
        const knowledge = knowledgeScore(recipe, context);
        const score = knowledge.score + CONTENT_WEIGHT * (content.get(recipe.id) ?? 0) - WEEKLY_REPEAT_PENALTY * (weekCounts.get(recipe.id) ?? 0);
        if (!best || score > best.score + 1e-9) best = { recipe, score, expiringNames: knowledge.expiringNames };
      }
      const { recipe, expiringNames } = best!;

      // Trừ kho ảo như khi bấm "Đã ăn" một khẩu phần (nguyên liệu tùy chọn và đồ đã hết hạn không trừ).
      const after = new Map(planConsumption(recipe.ingredients, 1, recipe.servings, pantry, now)
        .flatMap((line) => line.deductions.map((deduction) => [deduction.pantryItemId, deduction.quantityAfter] as const)));
      pantry = pantry.map((item) => (after.has(item.id) ? { ...item, quantity: after.get(item.id)! } : item)).filter((item) => item.quantity > 0);

      placed.push({ day: dayIndex, recipeId: recipe.id });
      weekCounts.set(recipe.id, (weekCounts.get(recipe.id) ?? 0) + 1);
      today.calories += recipe.calories;
      today.proteinG += recipe.proteinG;
      today.meals += 1;
      return { mealType, recipeId: recipe.id, servings: 1, reason: reasonFor(expiringNames) };
    });
    return { dayIndex, meals };
  });

  return {
    summary: "Thực đơn được xếp theo calo từng bữa, ưu tiên thực phẩm sắp hết hạn trong kho, hợp khẩu vị và đa dạng trong tuần.",
    days,
  };
}
