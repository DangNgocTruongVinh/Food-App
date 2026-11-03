import type { DietType, MealType } from "@prisma/client";
import type { CollaborativeScore } from "./collaborative.js";
import type { ContentScore } from "./content-based.js";
import type { Block } from "./features.js";
import type { KnowledgePart, KnowledgeScore, MealTarget } from "./knowledge-based.js";

// Lý do ngắn bằng tiếng Việt cho mỗi gợi ý (GĐ3b-R5): lấy từ thành phần đóng góp lớn nhất của bộ trộn, rồi từ tiêu chí con
// lớn nhất của thành phần đó (khối đặc trưng của thuật toán 1, tiêu chí của thuật toán 3, món "vì" của thuật toán 2).

export type Algorithm = "content" | "collaborative" | "knowledge";

const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: "bữa sáng", LUNCH: "bữa trưa", DINNER: "bữa tối", SNACK: "bữa phụ" };
const DIET_LABEL: Partial<Record<DietType, string>> = { LOW_CARB: "ít tinh bột", HIGH_PROTEIN: "giàu đạm" };
const list = (names: string[], max = 3) => names.slice(0, max).join(", ");

export type ReasonInput = {
  algorithm: Algorithm | null;
  content?: ContentScore;
  collaborative?: CollaborativeScore;
  knowledge?: KnowledgeScore;
  recipe: { cuisine?: string | null };
  /** Tên món theo id (cho lý do của thuật toán 2). */
  recipeName: (id: string) => string | undefined;
  dietType?: DietType | null;
  mealType?: MealType;
  target: MealTarget;
  /** Có lịch sử ăn/đăng/thích: lý do nói "món bạn hay…"; chưa có thì vector chỉ từ hồ sơ, lý do nói theo hồ sơ. */
  hasHistory?: boolean;
};

export function contentReason(score: ContentScore, cuisine: string | null | undefined, hasHistory = true, block: Block | null = score.top) {
  switch (block) {
    case "ingredients": return score.ingredients.length ? `Có nguyên liệu bạn hay dùng: ${list(score.ingredients)}` : null;
    case "cuisine": return cuisine ? (hasHistory ? `Món ${cuisine}, hợp khẩu vị của bạn` : `Món ${cuisine}, đúng ẩm thực bạn thích`) : null;
    case "diet": return "Hợp chế độ ăn của bạn";
    case "meal": return hasHistory ? "Hợp bữa bạn hay ăn" : null;
    case "nutrition": return hasHistory ? "Dinh dưỡng gần với các món bạn hay chọn" : "Dinh dưỡng hợp mục tiêu trong hồ sơ của bạn";
    default: return null;
  }
}

function topKnowledgePart(parts: Record<KnowledgePart, number>): KnowledgePart | null {
  let best: KnowledgePart | null = null;
  for (const [part, value] of Object.entries(parts) as Array<[KnowledgePart, number]>) {
    if (value > 0 && (!best || value > parts[best])) best = part;
  }
  return best;
}

export function knowledgeReason(score: KnowledgeScore, input: Pick<ReasonInput, "dietType" | "mealType" | "target">) {
  switch (topKnowledgePart(score.parts)) {
    case "expiring": {
      const count = score.expiringNames.length;
      return `Dùng ${count} thực phẩm sắp hết hạn: ${list(score.expiringNames)}`;
    }
    case "pantry": return `Có sẵn ${score.pantryCount}/${score.requiredCount} nguyên liệu trong kho`;
    case "nutrition": {
      const kcal = Math.round(input.target.calories / 10) * 10;
      return input.mealType ? `Vừa với khoảng ${kcal} kcal của ${MEAL_LABEL[input.mealType]}` : `Vừa với khoảng ${kcal} kcal cho một bữa của bạn`;
    }
    case "diversity": return "Khác các món bạn ăn mấy ngày gần đây";
    case "preference": return input.dietType && DIET_LABEL[input.dietType] ? `Hợp chế độ ${DIET_LABEL[input.dietType]}` : "Hợp chế độ ăn của bạn";
    default: return null;
  }
}

export function collaborativeReason(score: CollaborativeScore, recipeName: ReasonInput["recipeName"]) {
  const name = score.because ? recipeName(score.because) : undefined;
  return name ? `Người hay nấu ${name} cũng nấu món này` : null;
}

export const FALLBACK_REASON = "Hợp hồ sơ ăn uống của bạn";

/** Lý do theo thành phần đóng góp lớn nhất; thành phần đó không viết được lý do thì thử các thành phần còn lại. */
export function recommendationReason(input: ReasonInput, order: Algorithm[]) {
  for (const algorithm of order) {
    const reason = algorithm === "content" && input.content ? contentReason(input.content, input.recipe.cuisine, input.hasHistory ?? true)
      : algorithm === "knowledge" && input.knowledge ? knowledgeReason(input.knowledge, input)
        : algorithm === "collaborative" && input.collaborative ? collaborativeReason(input.collaborative, input.recipeName)
          : null;
    if (reason) return reason;
  }
  return FALLBACK_REASON;
}

/** "Món tương tự": có nguyên liệu chung thì nêu ra (dễ hiểu nhất), không thì theo khối giống nhất giữa hai món. */
export function similarReason(score: ContentScore, baseCuisine: string | null | undefined) {
  if (score.ingredients.length && score.blocks.ingredients > 0) return `Cùng nguyên liệu: ${list(score.ingredients)}`;
  switch (score.top) {
    case "ingredients": return score.ingredients.length ? `Cùng nguyên liệu: ${list(score.ingredients)}` : "Nguyên liệu tương tự";
    case "cuisine": return baseCuisine ? `Cùng ẩm thực ${baseCuisine}` : "Cùng ẩm thực";
    case "nutrition": return "Dinh dưỡng tương tự";
    case "meal": return "Cùng bữa ăn";
    case "diet": return "Cùng chế độ ăn";
    default: return "Món tương tự";
  }
}

export const alsoCookedReason = (baseName: string) => `Người nấu ${baseName} cũng nấu món này`;
