import type { DietType, MealType } from "@prisma/client";
import { groupPantryByName } from "../../services/pantry-match.js";
import type { FitPantryItem } from "../../services/recipe-fit.service.js";
import { alsoCooked, type CollaborativeModel, collaborativeScores, interactedCount } from "./collaborative.js";
import { type ContentProfile, contentScores, similarRecipes, userVector } from "./content-based.js";
import { type FeatureRecipe, type FeatureSpace, getFeatureSpace, similarity } from "./features.js";
import type { Interaction } from "./interactions.js";
import {
  type KnowledgeRecipe, knowledgeScore, type KnowledgeScore, mealTarget, pantryFeature, recentWindowStart, type TargetProfile, usesPantryItem,
} from "./knowledge-based.js";
import { type Algorithm, alsoCookedReason, pickReason, reasonCandidates, similarReason } from "./reasons.js";
import { safeRecipes, type SafetyProfile, type SafetyRecipe } from "./safety.js";

// Bộ trộn (GĐ3b-R5), hàm thuần (dữ liệu nạp ở recommendation.service.ts):
//   1. ứng viên = lọc an toàn (safety.ts) [+ đúng bữa, + dùng thực phẩm X, + có nguyên liệu trong kho ở ngữ cảnh Kho]
//   2. ŝ_a = min–max của điểm thuật toán a trên tập ứng viên (mọi điểm bằng nhau → 0)
//   3. γ_u = n_u/(n_u + κ), κ = 10: w2' = w2·γ_u, phần (1 − γ_u)·w2 chia cho w1, w3 theo tỷ lệ
//   4. S = Σ_a w_a'·ŝ_a;  5. MMR: chọn lần lượt argmax 0,8·S(r) − 0,2·max_{s đã chọn} cos(v_r, v_s)
//   6. lý do từ thành phần có w_a'·ŝ_a lớn nhất (reasons.ts)

export type RecommendationContext = "today" | "for-you" | "pantry" | "similar" | "also-cooked";
export const ALGORITHMS: Algorithm[] = ["content", "collaborative", "knowledge"];
export const CONTEXT_WEIGHTS: Record<RecommendationContext, Record<Algorithm, number>> = {
  today: { content: 0.35, collaborative: 0.25, knowledge: 0.4 },
  "for-you": { content: 0.45, collaborative: 0.3, knowledge: 0.25 },
  pantry: { content: 0.15, collaborative: 0.1, knowledge: 0.75 },
  similar: { content: 1, collaborative: 0, knowledge: 0 },
  "also-cooked": { content: 0, collaborative: 1, knowledge: 0 },
};
export const COLD_START_KAPPA = 10;
export const MMR_LAMBDA = 0.8;

/** Min–max về [0, 1] trên tập id; id không có điểm tính là 0; mọi điểm bằng nhau → 0 (thuật toán không phân biệt được món nào). */
export function minMax(scores: Map<string, number>, ids: string[]) {
  const values = ids.map((id) => scores.get(id) ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return new Map(ids.map((id, index) => [id, max > min ? (values[index] - min) / (max - min) : 0]));
}

/** Khởi đầu lạnh: giảm trọng số thuật toán 2 theo γ_u, chia phần bớt đi cho 1 và 3 theo tỷ lệ của chúng. */
export function coldStartWeights(weights: Record<Algorithm, number>, interacted: number, kappa = COLD_START_KAPPA) {
  const gamma = interacted / (interacted + kappa);
  const freed = weights.collaborative * (1 - gamma);
  const others = weights.content + weights.knowledge;
  if (!others) return { ...weights, collaborative: weights.collaborative * gamma };
  return {
    content: weights.content + (freed * weights.content) / others,
    collaborative: weights.collaborative * gamma,
    knowledge: weights.knowledge + (freed * weights.knowledge) / others,
  };
}

export type Blended = { recipeId: string; score: number; components: Record<Algorithm, number> };

export function blendScores(ids: string[], raw: Record<Algorithm, Map<string, number>>, weights: Record<Algorithm, number>): Blended[] {
  const normalized = Object.fromEntries(ALGORITHMS.map((algorithm) => [algorithm, minMax(raw[algorithm], ids)])) as Record<Algorithm, Map<string, number>>;
  return ids
    .map((recipeId) => {
      const components = Object.fromEntries(ALGORITHMS.map((algorithm) => [algorithm, weights[algorithm] * normalized[algorithm].get(recipeId)!])) as Record<Algorithm, number>;
      return { recipeId, components, score: ALGORITHMS.reduce((sum, algorithm) => sum + components[algorithm], 0) };
    })
    .sort((a, b) => b.score - a.score || a.recipeId.localeCompare(b.recipeId));
}

/** Đa dạng hóa MMR (Maximal Marginal Relevance): tránh cả danh sách toàn món giống nhau. */
export function mmr(items: Blended[], space: FeatureSpace, limit: number, lambda = MMR_LAMBDA) {
  const remaining = [...items];
  // max_{s đã chọn} cos(v_r, v_s) của từng món còn lại, cập nhật dần với món vừa chọn (O(limit·n) phép so).
  const redundancy = new Map(remaining.map((item) => [item.recipeId, 0]));
  const picked: Blended[] = [];
  while (picked.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    remaining.forEach((item, index) => {
      const value = lambda * item.score - (1 - lambda) * redundancy.get(item.recipeId)!;
      if (value > bestValue) { bestValue = value; bestIndex = index; }
    });
    const [chosen] = remaining.splice(bestIndex, 1);
    picked.push(chosen);
    const chosenVector = space.vectors.get(chosen.recipeId);
    if (!chosenVector) continue;
    for (const item of remaining) {
      const vector = space.vectors.get(item.recipeId);
      if (vector) redundancy.set(item.recipeId, Math.max(redundancy.get(item.recipeId)!, similarity(vector, chosenVector).score));
    }
  }
  return picked;
}

export type EngineRecipe = SafetyRecipe & FeatureRecipe & KnowledgeRecipe & {
  slug: string; name: string; imageUrl: string | null; prepMinutes: number; cookMinutes: number; cuisine: string;
};
export type EngineProfile = SafetyProfile & ContentProfile & TargetProfile & { dietType?: DietType | null };
export type EngineData = {
  userId: string;
  /** Các món đang hiện (bộ món dùng để tính đặc trưng). */
  recipes: EngineRecipe[];
  profile: EngineProfile | null;
  /** Kho còn số lượng của người dùng. */
  pantry: FitPantryItem[];
  /** Lịch sử của chính người dùng (thuật toán 1, f_dạng). */
  interactions: Interaction[];
  model: CollaborativeModel;
  /** Đã ăn hôm nay (thực đơn đang áp dụng): calo, đạm, số bữa. */
  today: { calories: number; proteinG: number; meals: number };
  now: Date;
};
export type EngineQuery = {
  context: RecommendationContext;
  limit: number;
  mealType?: MealType;
  recipeId?: string;
  /** Ngữ cảnh "gợi ý món cho thực phẩm X" (đã kiểm tra quyền sở hữu ở service). */
  focusItem?: FitPantryItem;
  /** Chỉ dùng cho đánh giá (scripts/eval-recommendation.ts): thay trọng số của ngữ cảnh. */
  weights?: Record<Algorithm, number>;
};

export const recipeSummary = (recipe: EngineRecipe) => ({
  id: recipe.id, slug: recipe.slug, name: recipe.name, imageUrl: recipe.imageUrl, calories: recipe.calories,
  prepMinutes: recipe.prepMinutes, cookMinutes: recipe.cookMinutes, cuisine: recipe.cuisine, dietTags: recipe.dietTags, mealTypes: recipe.mealTypes,
});
export type RecommendationItem = {
  recipe: ReturnType<typeof recipeSummary>;
  score: number;
  reason: string;
  components: Record<Algorithm, number>;
};

const zeroComponents = (): Record<Algorithm, number> => ({ content: 0, collaborative: 0, knowledge: 0 });

/** Một lần gợi ý: luôn lọc an toàn trước, rồi chạy (các) thuật toán theo ngữ cảnh. */
export function runRecommendation(data: EngineData, query: EngineQuery): { coldStart: boolean; items: RecommendationItem[] } {
  const space = getFeatureSpace(data.recipes);
  const byId = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));
  const coldStart = interactedCount(data.model, data.userId) < COLD_START_KAPPA;
  let candidates = safeRecipes(data.recipes, data.profile, { mealType: query.mealType }).filter((recipe) => recipe.id !== query.recipeId);
  if (query.focusItem) candidates = candidates.filter((recipe) => usesPantryItem(recipe, query.focusItem!));
  const pantryIndex = groupPantryByName(data.pantry);
  if (query.context === "pantry") candidates = candidates.filter((recipe) => pantryFeature(recipe, data.pantry, data.now, pantryIndex).inPantry > 0);
  const ids = candidates.map((recipe) => recipe.id);
  const item = (recipeId: string, score: number, reason: string, components = zeroComponents()) => ({
    recipe: recipeSummary(byId.get(recipeId)!), score, reason, components,
  });

  if (query.context === "similar" || query.context === "also-cooked") {
    const base = query.recipeId ? byId.get(query.recipeId) : undefined;
    if (!base) return { coldStart, items: [] };
    if (query.context === "similar") {
      return {
        coldStart,
        items: similarRecipes(space, base.id, ids, query.limit)
          .map((entry) => item(entry.recipeId, entry.score, similarReason(entry, base.cuisine), { ...zeroComponents(), content: entry.score })),
      };
    }
    return {
      coldStart,
      items: alsoCooked(data.model, base.id, data.userId, query.limit, new Set(ids))
        .map((entry) => item(entry.recipeId, entry.similarity, alsoCookedReason(base.name), { ...zeroComponents(), collaborative: entry.similarity })),
    };
  }

  const user = userVector(data.profile, data.interactions, space, data.now);
  const content = new Map(contentScores(user, ids, space).map((entry) => [entry.recipeId, entry]));
  const collaborative = new Map(collaborativeScores(data.model, data.userId, ids).map((entry) => [entry.recipeId, entry]));
  const windowStart = recentWindowStart(data.now);
  const recentRecipeIds = [...new Set(data.interactions
    .filter((entry) => (entry.kind === "EATEN" || entry.kind === "PLANNED") && entry.at >= windowStart && entry.at <= data.now)
    .map((entry) => entry.recipeId))];
  const target = mealTarget(data.profile, query.mealType, data.today);
  const knowledge = new Map<string, KnowledgeScore>(candidates.map((recipe) => [recipe.id, knowledgeScore(recipe, {
    pantry: data.pantry, pantryIndex, dietType: data.profile?.dietType, target, recentRecipeIds, space, now: data.now,
  })]));
  const weights = coldStartWeights(query.weights ?? CONTEXT_WEIGHTS[query.context], interactedCount(data.model, data.userId));
  const raw = {
    content: new Map([...content].map(([id, entry]) => [id, entry.score])),
    collaborative: new Map([...collaborative].map(([id, entry]) => [id, entry.score])),
    knowledge: new Map([...knowledge].map(([id, entry]) => [id, entry.score])),
  };
  const picked = mmr(blendScores(ids, raw, weights), space, query.limit);
  const usedKinds = new Set<string>();
  return {
    coldStart,
    items: picked.map((entry) => {
      const candidatesForReason = reasonCandidates({
        content: content.get(entry.recipeId),
        collaborative: collaborative.get(entry.recipeId),
        knowledge: knowledge.get(entry.recipeId),
        recipe: byId.get(entry.recipeId)!,
        recipeName: (id) => byId.get(id)?.name,
        dietType: data.profile?.dietType,
        mealType: query.mealType,
        target,
        hasHistory: data.interactions.length > 0,
      }, entry.components, weights);
      const reason = pickReason(candidatesForReason, usedKinds);
      return item(entry.recipeId, entry.score, reason, entry.components);
    }),
  };
}
