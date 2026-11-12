import type { MemberRecipe } from "../../types";

// Công thức tự viết trong bài cộng đồng: bản nháp của form, kiểm tra và chuyển sang dữ liệu gửi API. Giới hạn khớp Zod
// backend (community-member-recipe.ts); backend vẫn kiểm tra lại.

export const MEMBER_RECIPE_LIMITS = {
  name: 120, servings: 20, minutes: 1440, ingredients: 30, ingredientName: 80, quantity: 20, unit: 20, steps: 20, step: 500,
} as const;

export type MemberIngredientDraft = { key: string; name: string; quantity: string; unit: string };
export type MemberStepDraft = { key: string; text: string };
export type MemberRecipeDraft = {
  name: string; servings: string; minutes: string; ingredients: MemberIngredientDraft[]; steps: MemberStepDraft[];
};

let keySeed = 0;
const rowKey = () => `mr-${(keySeed += 1)}`;
export const emptyMemberIngredient = (): MemberIngredientDraft => ({ key: rowKey(), name: "", quantity: "", unit: "" });
export const emptyMemberStep = (): MemberStepDraft => ({ key: rowKey(), text: "" });

export function emptyMemberRecipeDraft(): MemberRecipeDraft {
  return { name: "", servings: "2", minutes: "30", ingredients: [emptyMemberIngredient(), emptyMemberIngredient()], steps: [emptyMemberStep()] };
}

export function draftFromMemberRecipe(recipe: MemberRecipe): MemberRecipeDraft {
  return {
    name: recipe.name, servings: String(recipe.servings), minutes: String(recipe.minutes),
    ingredients: recipe.ingredients.map((item) => ({ key: rowKey(), ...item })),
    steps: recipe.steps.map((text) => ({ key: rowKey(), text })),
  };
}

const L = MEMBER_RECIPE_LIMITS;
const wholeNumber = (value: string, min: number, max: number) => {
  const number = Number(value.trim());
  return value.trim() && Number.isInteger(number) && number >= min && number <= max ? number : null;
};

/**
 * Bản nháp → công thức gửi API. Dòng nguyên liệu/bước để trống bị bỏ qua; dòng chỉ có số lượng/đơn vị mà thiếu tên thì báo lỗi.
 * Trả về { recipe } hoặc { error } (câu tiếng Việt, hiện ngay trong form).
 */
export function toMemberRecipe(draft: MemberRecipeDraft): { recipe: MemberRecipe } | { error: string } {
  const name = draft.name.trim();
  if (name.length < 2 || name.length > L.name) return { error: `Tên món cần từ 2 đến ${L.name} ký tự.` };
  const servings = wholeNumber(draft.servings, 1, L.servings);
  if (servings === null) return { error: `Khẩu phần là số nguyên từ 1 đến ${L.servings}.` };
  const minutes = wholeNumber(draft.minutes, 1, L.minutes);
  if (minutes === null) return { error: `Thời gian là số phút từ 1 đến ${L.minutes}.` };

  const rows = draft.ingredients
    .map((row) => ({ name: row.name.trim(), quantity: row.quantity.trim(), unit: row.unit.trim() }))
    .filter((row) => row.name || row.quantity || row.unit);
  if (rows.some((row) => !row.name)) return { error: "Mỗi dòng nguyên liệu cần có tên." };
  if (!rows.length) return { error: "Thêm ít nhất một nguyên liệu." };
  if (rows.length > L.ingredients) return { error: `Tối đa ${L.ingredients} nguyên liệu.` };
  if (rows.some((row) => row.name.length > L.ingredientName || row.quantity.length > L.quantity || row.unit.length > L.unit)) {
    return { error: `Tên nguyên liệu tối đa ${L.ingredientName} ký tự; số lượng và đơn vị tối đa ${L.quantity} ký tự.` };
  }

  const steps = draft.steps.map((step) => step.text.trim()).filter(Boolean);
  if (!steps.length) return { error: "Thêm ít nhất một bước làm." };
  if (steps.length > L.steps) return { error: `Tối đa ${L.steps} bước.` };
  if (steps.some((step) => step.length > L.step)) return { error: `Mỗi bước tối đa ${L.step} ký tự.` };

  return { recipe: { name, servings, minutes, ingredients: rows, steps } };
}

/** Một dòng nguyên liệu để hiển thị: "300 g Tôm", "Muối" (số lượng/đơn vị trống thì chỉ có tên). */
export function memberIngredientLabel({ name, quantity, unit }: MemberRecipe["ingredients"][number]) {
  return [quantity, unit, name].filter(Boolean).join(" ");
}
