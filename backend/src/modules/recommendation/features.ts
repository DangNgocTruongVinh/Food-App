import type { DietType, MealType } from "@prisma/client";
import { normalizeFoodText } from "../../services/dietary.service.js";

// Vector đặc trưng món cho thuật toán 1 (lọc theo nội dung, GĐ3b-R3) và độ đa dạng của thuật toán 3.
// Mỗi món là 5 khối thưa, mỗi khối chuẩn hóa L2 riêng:
//   nguyên liệu (TF-IDF: tf = 1, nguyên liệu tùy chọn 0,5; idf = ln((1+N)/(1+df)) + 1), ẩm thực (one-hot),
//   bữa và nhãn chế độ ăn (multi-hot), dinh dưỡng (z-score kcal/đạm/tinh bột/béo trên cả bộ món, cắt ±3, chia 3).
// Độ tương đồng = Σ_b w_b · cos_b. Khi mọi khối của hai món đều khác 0, tổng này đúng bằng cosine của hai vector ghép
// [√w_b · x_b] (vì mỗi vector ghép có độ dài 1), nên vừa là cosine chuẩn vừa tách được khối đóng góp để làm lý do.

export const BLOCK_WEIGHTS = { ingredients: 0.45, cuisine: 0.15, meal: 0.1, diet: 0.1, nutrition: 0.2 } as const;
export type Block = keyof typeof BLOCK_WEIGHTS;
export const BLOCKS = Object.keys(BLOCK_WEIGHTS) as Block[];
export type SparseVector = Map<string, number>;
export type FeatureVector = Record<Block, SparseVector>;

export const NUTRIENTS = ["calories", "proteinG", "carbsG", "fatG"] as const;
export type Nutrient = (typeof NUTRIENTS)[number];
export type NutritionStats = Record<Nutrient, { mean: number; std: number }>;

export type FeatureRecipe = {
  id: string;
  cuisine: string | null;
  mealTypes: MealType[];
  dietTags: DietType[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  updatedAt: Date;
  ingredients: Array<{ name: string; optional?: boolean }>;
};

export type FeatureSpace = {
  version: string;
  size: number;
  idf: Map<string, number>;
  /** Tên hiển thị của mỗi khóa nguyên liệu (lần xuất hiện đầu tiên), để viết lý do. */
  ingredientLabels: Map<string, string>;
  nutrition: NutritionStats;
  vectors: Map<string, FeatureVector>;
};

export const emptyVector = (): FeatureVector => ({
  ingredients: new Map(), cuisine: new Map(), meal: new Map(), diet: new Map(), nutrition: new Map(),
});

export function normalizeL2(vector: SparseVector): SparseVector {
  const length = Math.sqrt([...vector.values()].reduce((sum, value) => sum + value * value, 0));
  if (!length) return new Map();
  return new Map([...vector].map(([key, value]) => [key, value / length]));
}

export function dot(a: SparseVector, b: SparseVector) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let sum = 0;
  for (const [key, value] of small) sum += value * (large.get(key) ?? 0);
  return sum;
}

export const idfOf = (size: number, documentFrequency: number) => Math.log((1 + size) / (1 + documentFrequency)) + 1;

/** tf của từng nguyên liệu trong một món: 1, nguyên liệu tùy chọn 0,5 (trùng tên thì lấy giá trị lớn hơn). */
function termFrequencies(recipe: Pick<FeatureRecipe, "ingredients">) {
  const tf = new Map<string, number>();
  for (const ingredient of recipe.ingredients) {
    const key = normalizeFoodText(ingredient.name);
    tf.set(key, Math.max(tf.get(key) ?? 0, ingredient.optional ? 0.5 : 1));
  }
  return tf;
}

function nutritionStats(recipes: FeatureRecipe[]): NutritionStats {
  const stats = {} as NutritionStats;
  for (const nutrient of NUTRIENTS) {
    const values = recipes.map((recipe) => recipe[nutrient]);
    const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length);
    stats[nutrient] = { mean, std: Math.sqrt(variance) };
  }
  return stats;
}

/** z-score cắt ±3 rồi chia 3 (về khoảng [−1, 1]); độ lệch chuẩn 0 (mọi món như nhau) → 0. */
export function nutritionBlock(values: Record<Nutrient, number>, stats: NutritionStats): SparseVector {
  const block: SparseVector = new Map();
  for (const nutrient of NUTRIENTS) {
    const { mean, std } = stats[nutrient];
    const z = std ? Math.max(-3, Math.min(3, (values[nutrient] - mean) / std)) / 3 : 0;
    if (z) block.set(nutrient, z);
  }
  return normalizeL2(block);
}

const multiHot = (keys: string[]) => normalizeL2(new Map(keys.map((key) => [key, 1])));

/** Phiên bản bộ món: số món + updatedAt lớn nhất (Admin thêm/sửa/xóa món thì đổi). */
export function catalogVersion(recipes: Array<Pick<FeatureRecipe, "updatedAt">>) {
  const latest = recipes.reduce((max, recipe) => Math.max(max, recipe.updatedAt.getTime()), 0);
  return `${recipes.length}:${latest}`;
}

export function buildFeatureSpace(recipes: FeatureRecipe[]): FeatureSpace {
  const frequencies = recipes.map((recipe) => termFrequencies(recipe));
  const documentFrequency = new Map<string, number>();
  for (const tf of frequencies) for (const key of tf.keys()) documentFrequency.set(key, (documentFrequency.get(key) ?? 0) + 1);
  const idf = new Map([...documentFrequency].map(([key, df]) => [key, idfOf(recipes.length, df)]));
  const ingredientLabels = new Map<string, string>();
  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = normalizeFoodText(ingredient.name);
      if (!ingredientLabels.has(key)) ingredientLabels.set(key, ingredient.name.trim());
    }
  }
  const nutrition = nutritionStats(recipes);
  const vectors = new Map<string, FeatureVector>();
  recipes.forEach((recipe, index) => {
    vectors.set(recipe.id, {
      ingredients: normalizeL2(new Map([...frequencies[index]].map(([key, tf]) => [key, tf * idf.get(key)!]))),
      cuisine: recipe.cuisine?.trim() ? multiHot([normalizeFoodText(recipe.cuisine)]) : new Map(),
      meal: multiHot(recipe.mealTypes),
      diet: multiHot(recipe.dietTags),
      nutrition: nutritionBlock(recipe, nutrition),
    });
  });
  return { version: catalogVersion(recipes), size: recipes.length, idf, ingredientLabels, nutrition, vectors };
}

let cached: FeatureSpace | null = null;

/** Không gian đặc trưng có cache: chỉ tính lại khi phiên bản bộ món đổi. */
export function getFeatureSpace(recipes: FeatureRecipe[]) {
  const version = catalogVersion(recipes);
  if (!cached || cached.version !== version) cached = buildFeatureSpace(recipes);
  return cached;
}

export type Similarity = { score: number; blocks: Record<Block, number> };

/** Σ_b w_b · cos_b(a, b) và phần đóng góp w_b · cos_b của từng khối (các khối đã chuẩn hóa nên cos_b = tích vô hướng). */
export function similarity(a: FeatureVector, b: FeatureVector, weights: Record<Block, number> = BLOCK_WEIGHTS): Similarity {
  const blocks = {} as Record<Block, number>;
  let score = 0;
  for (const block of BLOCKS) {
    blocks[block] = weights[block] * dot(a[block], b[block]);
    score += blocks[block];
  }
  return { score, blocks };
}

/** Khối đóng góp lớn nhất (dương) — dùng làm lý do; không có khối nào dương thì null. */
export function topBlock(blocks: Record<Block, number>): Block | null {
  let best: Block | null = null;
  for (const block of BLOCKS) if (blocks[block] > 0 && (!best || blocks[block] > blocks[best])) best = block;
  return best;
}
