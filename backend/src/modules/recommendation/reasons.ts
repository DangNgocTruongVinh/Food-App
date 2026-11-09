import type { DietType, MealType } from "@prisma/client";
import type { CollaborativeScore } from "./collaborative.js";
import type { ContentScore } from "./content-based.js";
import type { Block } from "./features.js";
import type { KnowledgePart, KnowledgeScore, MealTarget } from "./knowledge-based.js";

// Lý do ngắn bằng tiếng Việt cho mỗi gợi ý (GĐ3b-R5): lấy từ thành phần đóng góp lớn nhất của bộ trộn, rồi từ tiêu chí con
// lớn nhất của thành phần đó (khối đặc trưng của thuật toán 1, tiêu chí của thuật toán 3, món "vì" của thuật toán 2).

export type Algorithm = "content" | "collaborative" | "knowledge";
/** Thành phần của bộ trộn: 3 thuật toán + độ phổ biến (chỉ có trọng số khi người dùng ít tương tác). */
export type Component = Algorithm | "popularity";
export const POPULARITY_REASON = "Nhiều người đang nấu món này";

const MEAL_LABEL: Record<MealType, string> = { BREAKFAST: "bữa sáng", LUNCH: "bữa trưa", DINNER: "bữa tối", SNACK: "bữa phụ" };
const DIET_LABEL: Partial<Record<DietType, string>> = { LOW_CARB: "ít tinh bột", HIGH_PROTEIN: "giàu đạm" };
const list = (names: string[], max = 3) => names.slice(0, max).join(", ");

export type ReasonInput = {
  content?: ContentScore;
  collaborative?: CollaborativeScore;
  knowledge?: KnowledgeScore;
  recipe: { cuisine?: string | null };
  /** Tên món theo id (cho lý do của thuật toán 2). */
  recipeName: (id: string) => string | undefined;
  dietType?: DietType | null;
  mealType?: MealType;
  target: MealTarget;
  /** Điểm phổ biến thô của món (Σ r_ui của mọi người); > 0 mới viết được lý do phổ biến. */
  popularity?: number;
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

export function knowledgeReason(
  score: KnowledgeScore, input: Pick<ReasonInput, "dietType" | "mealType" | "target">, part: KnowledgePart | null = topKnowledgePart(score.parts),
) {
  switch (part) {
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

/** `kind`: loại lý do (khối/tiêu chí/thuật toán) — hai lý do cùng loại coi là trùng dù khác tên nguyên liệu. */
export type ReasonCandidate = { text: string; weight: number; kind: string };
/** Lý do thứ hai chỉ dùng khi đóng góp ít nhất 25% lý do chính (không đưa ra lý do yếu chỉ để khác đi). */
export const SECOND_REASON_MIN_SHARE = 0.25;

/**
 * Mọi lý do viết được cho một món, kèm trọng số đóng góp: thành phần a có đóng góp c_a = w_a'·ŝ_a, chia cho các tiêu chí con
 * theo tỷ lệ (khối đặc trưng của thuật toán 1, tiêu chí của thuật toán 3). Mọi c_a = 0 (vd. chỉ một ứng viên) → dùng trọng số
 * ngữ cảnh thay cho c_a. Cao xuống thấp; không trùng chữ.
 */
export function reasonCandidates(
  input: ReasonInput, contributions: Partial<Record<Component, number>>, weights: Partial<Record<Component, number>>,
) {
  const total = Object.values(contributions).reduce((sum, value) => sum + (value ?? 0), 0);
  const base = { content: 0, collaborative: 0, knowledge: 0, popularity: 0, ...(total > 0 ? contributions : weights) };
  const candidates: ReasonCandidate[] = [];
  const split = <K extends string>(prefix: string, share: number, parts: Record<K, number>, text: (key: K) => string | null) => {
    const positive = (Object.entries(parts) as Array<[K, number]>).filter(([, value]) => value > 0);
    const sum = positive.reduce((acc, [, value]) => acc + value, 0);
    for (const [key, value] of positive) {
      const reason = text(key);
      if (reason) candidates.push({ text: reason, weight: (share * value) / sum, kind: `${prefix}:${key}` });
    }
  };
  if (input.content) {
    split("content", base.content, input.content.blocks, (block) => contentReason(input.content!, input.recipe.cuisine, input.hasHistory ?? true, block));
  }
  if (input.knowledge) split("knowledge", base.knowledge, input.knowledge.parts, (part) => knowledgeReason(input.knowledge!, input, part));
  if (input.collaborative && input.collaborative.score > 0) {
    const reason = collaborativeReason(input.collaborative, input.recipeName);
    if (reason) candidates.push({ text: reason, weight: base.collaborative, kind: "collaborative" });
  }
  if ((input.popularity ?? 0) > 0 && base.popularity > 0) candidates.push({ text: POPULARITY_REASON, weight: base.popularity, kind: "popularity" });
  const seen = new Set<string>();
  return candidates.sort((a, b) => b.weight - a.weight).filter((candidate) => !seen.has(candidate.text) && seen.add(candidate.text));
}

/**
 * Đa dạng hóa lý do trong một danh sách: loại lý do chính đã dùng cho món trước thì lấy lý do kế tiếp thuộc loại chưa dùng,
 * nếu nó đủ lớn (≥ 25% lý do chính); không có thì giữ lý do chính (trùng còn hơn nêu lý do không đúng). `usedKinds` được cập nhật.
 */
export function pickReason(candidates: ReasonCandidate[], usedKinds: Set<string>) {
  if (!candidates.length) return FALLBACK_REASON;
  const [top] = candidates;
  const chosen = usedKinds.has(top.kind)
    ? candidates.find((candidate) => !usedKinds.has(candidate.kind) && candidate.weight >= SECOND_REASON_MIN_SHARE * top.weight) ?? top
    : top;
  usedKinds.add(chosen.kind);
  return chosen.text;
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
