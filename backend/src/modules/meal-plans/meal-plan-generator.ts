import type { DietType, FoodUnit, MealType, Recipe } from "@prisma/client";
import { normalizeFoodText, prefersDiet } from "../../services/dietary.service.js";
import { HttpError } from "../../utils/http-error.js";
import type { GeneratedPlan } from "../ai/ai.service.js";

// Thuật toán xếp thực đơn 7 ngày (không truy cập DB): xếp hạng món, chọn món theo bữa với quy tắc giảm lặp,
// thực đơn dự phòng (fallbackPlan) và kiểm tra/sửa thực đơn OpenAI (reconcileAIPlan).

export type RecipeWithIngredients = Recipe & { ingredients: Array<{ name: string; quantity: number; unit: FoodUnit }> };

/** Các bữa trong ngày theo hồ sơ (profile cho phép 3–4 bữa). */
export function mealSlots(mealsPerDay: number): MealType[] {
  return mealsPerDay >= 4 ? ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] : ["BREAKFAST", "LUNCH", "DINNER"];
}

// Điểm = số nguyên liệu đã có trong kho, cộng thêm khi món hợp chế độ ăn được ưu tiên (LOW_CARB/HIGH_PROTEIN).
function rankRecipes(recipes: RecipeWithIngredients[], pantryNames: Set<string>, dietType: DietType) {
  return recipes
    .map((recipe) => ({
      recipe,
      score: recipe.ingredients.filter((ingredient) => pantryNames.has(normalizeFoodText(ingredient.name))).length
        + (prefersDiet(recipe, dietType) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.recipe.calories - b.recipe.calories)
    .map(({ recipe }) => recipe);
}

// Món chưa khai báo bữa (mealTypes rỗng) dùng được cho mọi bữa.
function fitsMeal(recipe: RecipeWithIngredients, mealType: MealType) {
  return !recipe.mealTypes?.length || recipe.mealTypes.includes(mealType);
}

// Trạng thái cả tuần khi xếp món: số lần mỗi món đã dùng và các món của ngày hôm trước.
type WeekState = { dietType: DietType; counts: Map<string, number>; yesterday: Set<string>; yesterdayDinner: string | null };

const newWeekState = (dietType: DietType): WeekState => ({ dietType, counts: new Map(), yesterday: new Set(), yesterdayDinner: null });

function recordMeal(state: WeekState, recipeId: string) {
  state.counts.set(recipeId, (state.counts.get(recipeId) ?? 0) + 1);
}

function endDay(state: WeekState, meals: Array<{ mealType: MealType; recipeId: string }>) {
  state.yesterday = new Set(meals.map((meal) => meal.recipeId));
  state.yesterdayDinner = meals.find((meal) => meal.mealType === "DINNER")?.recipeId ?? null;
}

// Quy tắc ưu tiên, không bắt buộc (danh sách hợp lệ ít thì vẫn chọn được), theo thứ tự nặng → nhẹ:
// 1. tránh món bữa tối hôm trước ở bữa sáng/trưa hôm sau;
// 2. món hợp chế độ ăn được ưu tiên (LOW_CARB/HIGH_PROTEIN): phạt món không hợp nhiều hơn 1 lần dùng,
//    nên một món hợp chế độ được dùng tới 2 lần trước khi nhường món khác;
// 3. món ít xuất hiện trong tuần trước (phân bổ đều); 4. tránh món đã ăn hôm trước;
// 5. thứ hạng (kho thực phẩm), luôn < 1 nên chỉ dùng để phá hòa.
const CROSS_DAY_PENALTY = 100;
const DIET_PREFERENCE_PENALTY = 15;
const WEEKLY_USE_PENALTY = 10;
const YESTERDAY_PENALTY = 3;

function mealCost(recipe: RecipeWithIngredients, rankIndex: number, rankCount: number, mealType: MealType, state: WeekState) {
  const crossDay = recipe.id === state.yesterdayDinner && (mealType === "BREAKFAST" || mealType === "LUNCH");
  const missesPreferredDiet = (state.dietType === "LOW_CARB" || state.dietType === "HIGH_PROTEIN") && !prefersDiet(recipe, state.dietType);
  return (crossDay ? CROSS_DAY_PENALTY : 0)
    + (missesPreferredDiet ? DIET_PREFERENCE_PENALTY : 0)
    + (state.counts.get(recipe.id) ?? 0) * WEEKLY_USE_PENALTY
    + (state.yesterday.has(recipe.id) ? YESTERDAY_PENALTY : 0)
    + rankIndex / rankCount;
}

// Không lặp một món trong cùng ngày là bắt buộc, trừ khi bữa đó không còn món nào khác.
function pickRecipeForMeal(ranked: RecipeWithIngredients[], mealType: MealType, usedToday: Set<string>, state: WeekState) {
  const declared = ranked.filter((recipe) => recipe.mealTypes?.includes(mealType));
  const candidates = declared.length ? declared : ranked;
  const notUsedToday = candidates.filter((recipe) => !usedToday.has(recipe.id));
  const choices = notUsedToday.length ? notUsedToday : candidates;
  const cost = (recipe: RecipeWithIngredients) => mealCost(recipe, ranked.indexOf(recipe), ranked.length, mealType, state);
  return choices.reduce((best, recipe) => (cost(recipe) < cost(best) ? recipe : best));
}

const fallbackReason = "Phù hợp bữa ăn, kho thực phẩm và mục tiêu năng lượng.";

export function fallbackPlan(
  recipes: RecipeWithIngredients[],
  pantryNames: Set<string>,
  mealsPerDay: number,
  dietType: DietType = "BALANCED",
): GeneratedPlan {
  const ranked = rankRecipes(recipes, pantryNames, dietType);
  if (!ranked.length) throw new HttpError(422, "Chưa có công thức phù hợp để tạo thực đơn.");
  const state = newWeekState(dietType);
  return {
    summary: "Thực đơn được tạo bằng thuật toán ưu tiên thực phẩm sẵn có, đúng bữa và phù hợp chế độ ăn.",
    days: Array.from({ length: 7 }, (_, dayIndex) => {
      const usedToday = new Set<string>();
      const meals = mealSlots(mealsPerDay).map((mealType) => {
        const recipe = pickRecipeForMeal(ranked, mealType, usedToday, state);
        usedToday.add(recipe.id);
        recordMeal(state, recipe.id);
        return { mealType, recipeId: recipe.id, servings: 1, reason: fallbackReason };
      });
      endDay(state, meals);
      return { dayIndex, meals };
    }),
  };
}

/** Quá nửa số bữa AI trả về không dùng được thì coi là lỗi nặng và dùng fallbackPlan cho cả thực đơn. */
const MAX_INVALID_AI_MEAL_RATIO = 0.5;

/**
 * Kiểm tra thực đơn OpenAI trả về: mỗi bữa phải dùng món trong danh sách đã lọc (chế độ ăn, dị ứng, món không thích)
 * và đúng bữa theo mealTypes. Bữa vi phạm hoặc bị thiếu được thay bằng món chọn theo logic fallback
 * (cùng quy tắc ưu tiên giảm lặp, tính cả các món AI được giữ lại).
 */
export function reconcileAIPlan(
  aiPlan: GeneratedPlan,
  recipes: RecipeWithIngredients[],
  pantryNames: Set<string>,
  mealsPerDay: number,
  dietType: DietType = "BALANCED",
): { plan: GeneratedPlan; source: "ai" | "ai-corrected" | "fallback"; replacedMeals: number } {
  const fallback = () => ({ plan: fallbackPlan(recipes, pantryNames, mealsPerDay, dietType), source: "fallback" as const });
  const ranked = rankRecipes(recipes, pantryNames, dietType);
  const allowed = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const slots = mealSlots(mealsPerDay);
  const aiDays = new Map(aiPlan.days.map((day) => [day.dayIndex, day]));
  // Lỗi nặng: thiếu ngày nào trong 7 ngày.
  if (!ranked.length || Array.from({ length: 7 }, (_, dayIndex) => aiDays.has(dayIndex)).includes(false)) {
    return { ...fallback(), replacedMeals: slots.length * 7 };
  }

  let replacedMeals = 0;
  const state = newWeekState(dietType);
  const days = Array.from({ length: 7 }, (_, dayIndex) => {
    const aiMeals = [...aiDays.get(dayIndex)!.meals];
    const usedToday = new Set<string>();
    // Lượt 1: giữ các bữa AI hợp lệ (đúng danh sách, đúng bữa, không lặp trong ngày).
    const kept = slots.map((mealType) => {
      const index = aiMeals.findIndex((meal) => meal.mealType === mealType);
      const aiMeal = index >= 0 ? aiMeals.splice(index, 1)[0] : undefined;
      const recipe = aiMeal ? allowed.get(aiMeal.recipeId) : undefined;
      if (!aiMeal || !recipe || !fitsMeal(recipe, mealType) || usedToday.has(recipe.id)) return { mealType, aiMeal, valid: false };
      usedToday.add(recipe.id);
      recordMeal(state, recipe.id);
      return { mealType, aiMeal, valid: true };
    });
    // Lượt 2: thay các bữa vi phạm bằng món chọn theo logic fallback.
    const meals = kept.map(({ mealType, aiMeal, valid }) => {
      if (valid && aiMeal) return aiMeal;
      replacedMeals += 1;
      const replacement = pickRecipeForMeal(ranked, mealType, usedToday, state);
      usedToday.add(replacement.id);
      recordMeal(state, replacement.id);
      return { mealType, recipeId: replacement.id, servings: aiMeal?.servings ?? 1, reason: fallbackReason };
    });
    endDay(state, meals);
    return { dayIndex, meals };
  });

  if (replacedMeals / (slots.length * 7) > MAX_INVALID_AI_MEAL_RATIO) return { ...fallback(), replacedMeals };
  return { plan: { summary: aiPlan.summary, days }, source: replacedMeals ? "ai-corrected" : "ai", replacedMeals };
}
