import type { DietTag, FoodUnit, MealType, MemberRecipe } from "../../types";
import { COMMUNITY_IMAGE_MAX_BYTES, COMMUNITY_IMAGE_TYPES } from "../community/community.logic";
import type { AdminRecipeDetail, AdminRecipeInput, RecipeUsage } from "./admin.api";

// Kiểm tra phía client giống Zod backend (admin-recipes.schema.ts) để báo lỗi ngay tại trường/dòng.
export const RECIPE_LIMITS = {
  name: [2, 120], description: [1, 1000], cuisine: [1, 50], prepMinutes: [0, 600], cookMinutes: [0, 1440], servings: [1, 12],
  calories: [0, 5000], nutrient: [0, 1000], ingredientName: [1, 80], ingredientQuantityMax: 100_000, ingredients: [1, 40],
  step: [1, 500], steps: [1, 20],
} as const;

export const MEAL_TYPE_OPTIONS: Array<[MealType, string]> = [["BREAKFAST", "Bữa sáng"], ["LUNCH", "Bữa trưa"], ["DINNER", "Bữa tối"], ["SNACK", "Bữa phụ"]];
export const DIET_TAG_OPTIONS: Array<[DietTag, string]> = [
  ["BALANCED", "Cân bằng"], ["VEGETARIAN", "Món chay"], ["VEGAN", "Thuần chay"], ["LOW_CARB", "Ít tinh bột"], ["HIGH_PROTEIN", "Giàu đạm"],
];
export const UNIT_OPTIONS: Array<[FoodUnit, string]> = [["G", "g"], ["KG", "kg"], ["ML", "ml"], ["L", "lít"], ["ITEM", "cái"], ["PACKAGE", "gói"]];
export const CUISINE_OPTIONS = ["Việt Nam", "Nhật Bản", "Hàn Quốc", "Thái Lan", "Ý", "Hy Lạp", "Mỹ"];

export type IngredientRow = { key: string; name: string; quantity: string; unit: FoodUnit; optional: boolean };
export type StepRow = { key: string; text: string };
export type NumberField = "prepMinutes" | "cookMinutes" | "servings" | "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG";
export type RecipeFormValues = Record<"name" | "description" | "cuisine" | NumberField, string> & {
  dietTags: DietTag[]; mealTypes: MealType[]; imageUrl: string | null; ingredients: IngredientRow[]; steps: StepRow[];
};

let rowCounter = 0;
/** Khóa ổn định cho từng dòng nguyên liệu/bước (React key, liên kết lỗi), không gửi lên API. */
export const newRowKey = () => `row-${++rowCounter}`;
export const emptyIngredient = (): IngredientRow => ({ key: newRowKey(), name: "", quantity: "", unit: "G", optional: false });
export const emptyStep = (): StepRow => ({ key: newRowKey(), text: "" });

export function emptyRecipeForm(): RecipeFormValues {
  return {
    name: "", description: "", cuisine: "Việt Nam", prepMinutes: "10", cookMinutes: "20", servings: "1",
    calories: "", proteinG: "", carbsG: "", fatG: "", fiberG: "0",
    dietTags: ["BALANCED"], mealTypes: [], imageUrl: null, ingredients: [emptyIngredient()], steps: [emptyStep()],
  };
}

export function toRecipeForm(recipe: AdminRecipeDetail): RecipeFormValues {
  return {
    name: recipe.name, description: recipe.description, cuisine: recipe.cuisine,
    prepMinutes: String(recipe.prepMinutes), cookMinutes: String(recipe.cookMinutes), servings: String(recipe.servings),
    calories: String(recipe.calories), proteinG: String(recipe.proteinG), carbsG: String(recipe.carbsG), fatG: String(recipe.fatG),
    fiberG: String(recipe.fiberG), dietTags: recipe.dietTags, mealTypes: recipe.mealTypes, imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients.map((item) => ({ key: newRowKey(), name: item.name, quantity: String(item.quantity), unit: item.unit, optional: item.optional })),
    steps: recipe.instructions.map((text) => ({ key: newRowKey(), text })),
  };
}

// ---------- "Chuyển thành công thức" từ công thức tự viết của bài cộng đồng ----------

/** Đơn vị nhập tự do của thành viên → đơn vị chuẩn của món (so không phân biệt hoa thường, bỏ dấu chấm cuối). */
const UNIT_WORDS: Array<[FoodUnit, string[]]> = [
  ["G", ["g", "gr", "gam", "gram", "grams"]],
  ["KG", ["kg", "ký", "kí", "kilogram", "cân"]],
  ["ML", ["ml", "mililit", "mililít"]],
  ["L", ["l", "lít", "lit", "liter", "litre"]],
  ["ITEM", ["cái", "quả", "trái", "củ", "con", "miếng", "lát", "tép", "nhánh", "bó", "cây", "lá", "quả trứng"]],
  ["PACKAGE", ["gói", "hộp", "túi", "lon", "chai", "vỉ", "bịch"]],
];

export function guessFoodUnit(raw: string): FoodUnit | null {
  const word = raw.trim().toLocaleLowerCase("vi").replace(/\.$/, "");
  if (!word) return null;
  return UNIT_WORDS.find(([, words]) => words.includes(word))?.[0] ?? null;
}

/** "300", "1,5", "1.5", "1/2" → chuỗi số dương; không đọc được → "" (Admin điền, form báo lỗi tại dòng đó). */
export function guessQuantity(raw: string) {
  const text = raw.trim().replace(",", ".");
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  const value = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(text);
  return text && Number.isFinite(value) && value > 0 && value <= RECIPE_LIMITS.ingredientQuantityMax ? String(Number(value.toFixed(3))) : "";
}

/**
 * Điền trước form món mới từ công thức tự viết: tên, khẩu phần (≤ 12), thời gian nấu, nguyên liệu, các bước, mô tả lấy từ
 * nội dung bài. Dinh dưỡng, bữa, nhãn để Admin bổ sung. Đơn vị không quy đổi được → để trống số lượng để Admin xem lại dòng đó.
 */
export function recipeFormFromMemberRecipe(recipe: MemberRecipe, postContent: string): RecipeFormValues {
  const empty = emptyRecipeForm();
  const description = postContent.trim().slice(0, RECIPE_LIMITS.description[1]) || `Công thức của thành viên: ${recipe.name}.`;
  return {
    ...empty,
    name: recipe.name.slice(0, RECIPE_LIMITS.name[1]),
    description,
    prepMinutes: "0",
    cookMinutes: String(Math.min(recipe.minutes, RECIPE_LIMITS.cookMinutes[1])),
    servings: String(Math.min(Math.max(recipe.servings, RECIPE_LIMITS.servings[0]), RECIPE_LIMITS.servings[1])),
    ingredients: recipe.ingredients.slice(0, RECIPE_LIMITS.ingredients[1]).map((item) => {
      const unit = guessFoodUnit(item.unit);
      const knownUnit = unit !== null || !item.unit.trim();
      return { key: newRowKey(), name: item.name, quantity: knownUnit ? guessQuantity(item.quantity) : "", unit: unit ?? "G", optional: false };
    }),
    steps: recipe.steps.slice(0, RECIPE_LIMITS.steps[1]).map((text) => ({ key: newRowKey(), text })),
  };
}

export function toRecipeInput(form: RecipeFormValues): AdminRecipeInput {
  const number = (value: string) => Number(value);
  return {
    name: form.name.trim(), description: form.description.trim(), cuisine: form.cuisine.trim(),
    instructions: form.steps.map((step) => step.text.trim()),
    prepMinutes: number(form.prepMinutes), cookMinutes: number(form.cookMinutes), servings: number(form.servings),
    calories: number(form.calories), proteinG: number(form.proteinG), carbsG: number(form.carbsG), fatG: number(form.fatG),
    fiberG: number(form.fiberG), dietTags: form.dietTags, mealTypes: form.mealTypes, imageUrl: form.imageUrl,
    ingredients: form.ingredients.map((item) => ({ name: item.name.trim(), quantity: number(item.quantity), unit: item.unit, optional: item.optional })),
  };
}

export type RecipeFormErrors = {
  fields: Partial<Record<keyof RecipeFormValues, string>>;
  ingredients: Record<string, { name?: string; quantity?: string; diet?: string }>;
  steps: Record<string, string>;
};

export const hasRecipeErrors = (errors: RecipeFormErrors) =>
  Object.keys(errors.fields).length + Object.keys(errors.ingredients).length + Object.keys(errors.steps).length > 0;

const lengthError = (value: string, [min, max]: readonly [number, number], what: string) => {
  const length = value.trim().length;
  if (length < min) return min === 1 ? `Nhập ${what}.` : `Nhập ${what} ít nhất ${min} ký tự.`;
  if (length > max) return `Rút ${what} xuống tối đa ${max} ký tự (hiện có ${length}).`;
  return undefined;
};
const numberError = (value: string, [min, max]: readonly [number, number], integer: boolean) => {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    return `Nhập ${integer ? "số nguyên" : "số"} từ ${min} đến ${max.toLocaleString("vi-VN")}.`;
  }
  return undefined;
};
/** Giống backend: "Bơ" đứng riêng là nhập nhằng. */
const isAmbiguousButter = (name: string) => name.trim().toLocaleLowerCase("vi").replace(/\s+/g, " ") === "bơ";

export function validateRecipeForm(form: RecipeFormValues): RecipeFormErrors {
  const fields: RecipeFormErrors["fields"] = {
    name: lengthError(form.name, RECIPE_LIMITS.name, "tên món"),
    description: lengthError(form.description, RECIPE_LIMITS.description, "mô tả"),
    cuisine: lengthError(form.cuisine, RECIPE_LIMITS.cuisine, "ẩm thực"),
    prepMinutes: numberError(form.prepMinutes, RECIPE_LIMITS.prepMinutes, true),
    cookMinutes: numberError(form.cookMinutes, RECIPE_LIMITS.cookMinutes, true),
    servings: numberError(form.servings, RECIPE_LIMITS.servings, true),
    calories: numberError(form.calories, RECIPE_LIMITS.calories, true),
    proteinG: numberError(form.proteinG, RECIPE_LIMITS.nutrient, false),
    carbsG: numberError(form.carbsG, RECIPE_LIMITS.nutrient, false),
    fatG: numberError(form.fatG, RECIPE_LIMITS.nutrient, false),
    fiberG: numberError(form.fiberG, RECIPE_LIMITS.nutrient, false),
    dietTags: form.dietTags.length ? undefined : "Chọn ít nhất một nhãn chế độ ăn.",
    mealTypes: form.mealTypes.length ? undefined : "Chọn ít nhất một bữa.",
    ingredients: form.ingredients.length < RECIPE_LIMITS.ingredients[0] ? "Thêm ít nhất một nguyên liệu."
      : form.ingredients.length > RECIPE_LIMITS.ingredients[1] ? `Tối đa ${RECIPE_LIMITS.ingredients[1]} nguyên liệu.` : undefined,
    steps: form.steps.length < RECIPE_LIMITS.steps[0] ? "Thêm ít nhất một bước."
      : form.steps.length > RECIPE_LIMITS.steps[1] ? `Tối đa ${RECIPE_LIMITS.steps[1]} bước.` : undefined,
  };
  const ingredients: RecipeFormErrors["ingredients"] = {};
  for (const row of form.ingredients) {
    const name = isAmbiguousButter(row.name) ? "Ghi rõ \"Quả bơ\" hoặc \"Bơ lạt\"." : lengthError(row.name, RECIPE_LIMITS.ingredientName, "tên nguyên liệu");
    const quantity = Number(row.quantity);
    const quantityError = !row.quantity.trim() || !Number.isFinite(quantity) || quantity <= 0 || quantity > RECIPE_LIMITS.ingredientQuantityMax
      ? `Nhập số lượng lớn hơn 0, tối đa ${RECIPE_LIMITS.ingredientQuantityMax.toLocaleString("vi-VN")}.` : undefined;
    if (name || quantityError) ingredients[row.key] = { ...(name ? { name } : {}), ...(quantityError ? { quantity: quantityError } : {}) };
  }
  const steps: RecipeFormErrors["steps"] = {};
  form.steps.forEach((step, index) => {
    const error = lengthError(step.text, RECIPE_LIMITS.step, `bước ${index + 1}`);
    if (error) steps[step.key] = error;
  });
  return { fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => value)), ingredients, steps };
}

export type DietViolation = { ingredient: string; terms: string[]; dietTag: "VEGETARIAN" | "VEGAN" };

/** Lỗi 422 nhãn chay của backend: gắn lời giải thích vào đúng dòng nguyên liệu vi phạm. */
export function violationsByRow(violations: DietViolation[], rows: IngredientRow[]) {
  const result: Record<string, string> = {};
  for (const violation of violations) {
    const label = violation.dietTag === "VEGAN" ? "Thuần chay" : "Món chay";
    const row = rows.find((item) => item.name.trim().toLocaleLowerCase("vi") === violation.ingredient.trim().toLocaleLowerCase("vi"));
    if (row) result[row.key] = `Có "${violation.terms.join(", ")}" nên không hợp với nhãn ${label}. Bỏ nguyên liệu này hoặc bỏ nhãn ${label}.`;
  }
  return result;
}

/** Đổi chỗ một dòng lên/xuống; ra ngoài danh sách thì giữ nguyên. */
export function moveRow<T>(items: T[], index: number, delta: -1 | 1) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const isRecipeUsed = (usage: RecipeUsage) => usage.mealPlanItems + usage.posts > 0;

export function usageText(usage: RecipeUsage) {
  if (!isRecipeUsed(usage)) return "Chưa dùng";
  return [usage.mealPlanItems ? `${usage.mealPlanItems} bữa trong thực đơn` : null, usage.posts ? `${usage.posts} bài viết` : null].filter(Boolean).join(", ");
}

/** Vì sao không xóa được (đã dùng): giải thích và gợi ý Ẩn; chưa dùng thì null. */
export function deleteBlockedReason(usage: RecipeUsage) {
  return isRecipeUsed(usage) ? `Món đang có trong ${usageText(usage)} nên không xóa được. Hãy ẩn món: người dùng không thấy nữa, dữ liệu cũ vẫn giữ.` : null;
}

/** Ảnh công thức: kiểm tra trước khi gửi, khớp backend (JPG, PNG, WEBP; tối đa 5 MB). */
export function recipeImageError(file: Pick<File, "name" | "type" | "size">) {
  if (!COMMUNITY_IMAGE_TYPES.includes(file.type)) return `"${file.name}" không phải ảnh JPG, PNG hoặc WEBP.`;
  if (file.size > COMMUNITY_IMAGE_MAX_BYTES) return `"${file.name}" vượt quá 5 MB. Chọn ảnh nhỏ hơn.`;
  return null;
}
