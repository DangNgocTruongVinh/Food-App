import type { DietType } from "@prisma/client";
import { overlapsFoodTerms } from "../../services/dietary.service.js";

// Gợi ý dinh dưỡng của một thực đơn (thẻ "Gợi ý cho tuần này"), không truy cập DB. Trước GĐ3b-R2 nằm ở frontend
// (features/meal-plans/meal-plans.logic.ts, có hàm `asWords` riêng); nay tính ở backend và dùng chung
// `dietary.service` để mọi trang so khớp dị ứng/món không thích theo cùng một quy tắc.

/** Lượng chất xơ khuyến nghị mỗi ngày dùng cho gợi ý (hồ sơ chưa có chỉ tiêu chất xơ). */
export const FIBER_TARGET_G = 30;

export type MealPlanSuggestion = { key: string; text: string };
type SuggestionCandidate = MealPlanSuggestion & { excludedDiets?: DietType[]; conflicts?: string[] };
export type SuggestionProfile = {
  dietType?: DietType | null;
  allergies?: string[];
  dislikedFoods?: string[];
  dailyCalorieTarget?: number | null;
  fatTargetG?: number | null;
} | null | undefined;
type SuggestionPlan = { days: Array<{ items: Array<{ recipe: { fiberG: number; fatG: number } }> }> };

// Gợi ý không được mâu thuẫn với chế độ ăn, dị ứng hoặc món không thích (vd. "cá hồi" ↔ "cá", "Hải sản").
function conflictsWithProfile(candidate: SuggestionCandidate, profile: SuggestionProfile) {
  if (!profile) return false;
  if (profile.dietType && candidate.excludedDiets?.includes(profile.dietType)) return true;
  return overlapsFoodTerms(candidate.conflicts ?? [], [...(profile.allergies ?? []), ...(profile.dislikedFoods ?? [])]);
}

const fatCandidates: SuggestionCandidate[] = [
  {
    key: "omega3-fish", text: "Thêm cá béo như cá hồi, cá thu 1–2 bữa để có thêm Omega-3.",
    excludedDiets: ["VEGETARIAN", "VEGAN"], conflicts: ["hải sản", "thủy sản", "đồ biển", "seafood", "cá"],
  },
  {
    key: "omega3-plant", text: "Thêm Omega-3 từ thực vật: đậu nành, đậu hũ hoặc hạt óc chó.",
    conflicts: ["đậu nành", "đậu hũ", "óc chó", "các loại hạt"],
  },
  { key: "fat-plant-oil", text: "Nấu bằng dầu thực vật và giữ lượng chất béo như hiện tại." },
];

const formatGram = (value: number) => `${value.toLocaleString("vi-VN")} g`;

/** Chất xơ, chất béo trung bình mỗi ngày (cùng cách tính với thẻ thống kê tuần ở frontend: công thức, không nhân khẩu phần). */
export function planAverages(plan: SuggestionPlan) {
  const items = plan.days.flatMap((day) => day.items);
  const dayCount = Math.max(plan.days.length, 1);
  const sum = (pick: (recipe: { fiberG: number; fatG: number }) => number) => items.reduce((total, item) => total + pick(item.recipe), 0);
  return { fiber: Math.round(sum((recipe) => recipe.fiberG) / dayCount), fat: Math.round(sum((recipe) => recipe.fatG) / dayCount) };
}

/** Chỉ tiêu chất béo chỉ có khi hồ sơ đã tính chỉ tiêu (có mục tiêu calo); không dùng số tự đặt. */
const fatTargetOf = (profile: SuggestionProfile) => (profile?.dailyCalorieTarget ? profile.fatTargetG || null : null);

/** Hai gợi ý theo số liệu trung bình của thực đơn: chất xơ và chất béo; đã loại gợi ý mâu thuẫn với hồ sơ. */
export function mealPlanSuggestions(profile: SuggestionProfile, averages: { fiber: number; fat: number }, fatTarget = fatTargetOf(profile)) {
  const fiberHead = `Chất xơ trung bình ${formatGram(averages.fiber)} mỗi ngày`;
  const fiber: MealPlanSuggestion = {
    key: "fiber",
    text: averages.fiber < FIBER_TARGET_G
      ? `${fiberHead}, dưới mức ${formatGram(FIBER_TARGET_G)}: thêm 1–2 khẩu phần rau xanh mỗi ngày.`
      : `${fiberHead}, đạt mức ${formatGram(FIBER_TARGET_G)}.`,
  };
  const fatHead = fatTarget ? `Chất béo trung bình ${formatGram(averages.fat)} mỗi ngày (mục tiêu ${formatGram(fatTarget)})` : "";
  if (fatTarget && averages.fat > fatTarget) {
    return [fiber, { key: "fat-reduce", text: `${fatHead}: bớt món chiên, ưu tiên hấp, luộc, kho.` }];
  }
  const candidate = fatCandidates.find((item) => !conflictsWithProfile(item, profile))!;
  return [fiber, { key: candidate.key, text: fatHead ? `${fatHead}. ${candidate.text}` : candidate.text }];
}

export const planSuggestions = (plan: SuggestionPlan, profile: SuggestionProfile) => mealPlanSuggestions(profile, planAverages(plan));
