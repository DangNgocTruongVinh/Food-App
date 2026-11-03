import type { DietType } from "@prisma/client";
import { normalizeFoodText } from "../../services/dietary.service.js";
import { calculateNutritionTargets } from "../../services/nutrition.service.js";
import {
  BLOCKS, type Block, emptyVector, type FeatureSpace, type FeatureVector, normalizeL2, nutritionBlock, similarity, topBlock,
} from "./features.js";
import { CONTENT_WEIGHTS, decay, type Interaction } from "./interactions.js";

// Thuật toán 1 — lọc theo nội dung (GĐ3b-R3).
//   u = β·p_u + Σ_e ω(e)·e^(−Δ_e/τ)·v_{r(e)}  (cộng theo từng khối rồi chuẩn hóa L2 từng khối)
//   s1(u, r) = Σ_b w_b · cos_b(u, v_r);  "món tương tự": sim(a, b) = Σ_b w_b · cos_b(v_a, v_b)
// p_u (tiên nghiệm từ hồ sơ): ẩm thực ưa thích, nhãn chế độ ăn, dinh dưỡng mục tiêu cho một bữa. Chưa có lịch sử thì u = p_u.

export const PRIOR_WEIGHT = 1;

export type ContentProfile = {
  dietType?: DietType | null;
  preferredCuisines?: string[];
  mealsPerDay?: number | null;
  dailyCalorieTarget?: number | null;
  proteinTargetG?: number | null;
  carbTargetG?: number | null;
  fatTargetG?: number | null;
} & Parameters<typeof calculateNutritionTargets>[0];

/** Nhãn chế độ ăn của hồ sơ → các nhãn món tương ứng (thuần chay cũng là chay). */
const dietTagsFor = (dietType: DietType | null | undefined): DietType[] =>
  !dietType ? [] : dietType === "VEGAN" ? ["VEGAN", "VEGETARIAN"] : [dietType];

/** Vector tiên nghiệm từ hồ sơ; không có hồ sơ thì vector rỗng (điểm nội dung = 0 cho mọi món). */
export function profilePrior(profile: ContentProfile | null | undefined, space: FeatureSpace): FeatureVector {
  const prior = emptyVector();
  if (!profile) return prior;
  const cuisines = (profile.preferredCuisines ?? []).map(normalizeFoodText).filter(Boolean);
  prior.cuisine = normalizeL2(new Map(cuisines.map((key) => [key, 1])));
  prior.diet = normalizeL2(new Map(dietTagsFor(profile.dietType).map((tag) => [tag, 1])));
  const computed = calculateNutritionTargets(profile);
  const meals = Math.max(1, profile.mealsPerDay ?? 3);
  prior.nutrition = nutritionBlock({
    calories: (profile.dailyCalorieTarget ?? computed.calories) / meals,
    proteinG: (profile.proteinTargetG ?? computed.proteinG) / meals,
    carbsG: (profile.carbTargetG ?? computed.carbsG) / meals,
    fatG: (profile.fatTargetG ?? computed.fatG) / meals,
  }, space.nutrition);
  return prior;
}

/** Trọng số một tương tác: ω(loại) × số lần × e^(−Δ/τ). */
export const interactionWeight = (interaction: Interaction, now: Date) =>
  CONTENT_WEIGHTS[interaction.kind] * interaction.count * decay(interaction.at, now);

/** Vector sở thích người dùng: tiên nghiệm + lịch sử có suy giảm thời gian (món không còn trong bộ món thì bỏ qua). */
export function userVector(
  profile: ContentProfile | null | undefined, history: Interaction[], space: FeatureSpace, now = new Date(),
): FeatureVector {
  const sum = emptyVector();
  const add = (vector: FeatureVector, weight: number) => {
    for (const block of BLOCKS) {
      for (const [key, value] of vector[block]) sum[block].set(key, (sum[block].get(key) ?? 0) + weight * value);
    }
  };
  add(profilePrior(profile, space), PRIOR_WEIGHT);
  for (const interaction of history) {
    const vector = space.vectors.get(interaction.recipeId);
    if (vector) add(vector, interactionWeight(interaction, now));
  }
  const user = emptyVector();
  for (const block of BLOCKS) user[block] = normalizeL2(sum[block]);
  return user;
}

export type ContentScore = {
  recipeId: string;
  score: number;
  blocks: Record<Block, number>;
  /** Khối đóng góp lớn nhất (lý do); null nếu không khối nào dương. */
  top: Block | null;
  /** Tối đa 3 nguyên liệu đóng góp nhiều nhất vào khối nguyên liệu (tên hiển thị). */
  ingredients: string[];
};

function topIngredients(a: FeatureVector, b: FeatureVector, space: FeatureSpace, limit = 3) {
  return [...b.ingredients]
    .map(([key, value]) => ({ key, part: value * (a.ingredients.get(key) ?? 0) }))
    .filter((entry) => entry.part > 0)
    .sort((x, y) => y.part - x.part || x.key.localeCompare(y.key))
    .slice(0, limit)
    .map((entry) => space.ingredientLabels.get(entry.key) ?? entry.key);
}

function scoreAgainst(vector: FeatureVector, recipeId: string, space: FeatureSpace): ContentScore | null {
  const other = space.vectors.get(recipeId);
  if (!other) return null;
  const { score, blocks } = similarity(vector, other);
  return { recipeId, score, blocks, top: topBlock(blocks), ingredients: topIngredients(vector, other, space) };
}

/** s1 cho từng món ứng viên (đã qua lọc an toàn), cao xuống thấp. */
export function contentScores(user: FeatureVector, candidateIds: string[], space: FeatureSpace) {
  return candidateIds
    .map((id) => scoreAgainst(user, id, space))
    .filter((entry): entry is ContentScore => entry !== null)
    .sort((a, b) => b.score - a.score || a.recipeId.localeCompare(b.recipeId));
}

/** "Món tương tự": cosine giữa món đang xem và từng ứng viên (bỏ chính nó), cao xuống thấp. */
export function similarRecipes(space: FeatureSpace, recipeId: string, candidateIds: string[], limit = 6) {
  const base = space.vectors.get(recipeId);
  if (!base) return [];
  return contentScores(base, candidateIds.filter((id) => id !== recipeId), space).slice(0, limit);
}
