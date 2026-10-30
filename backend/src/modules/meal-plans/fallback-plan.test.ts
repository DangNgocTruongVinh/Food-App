import type { DietType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seedRecipesAsRecords } from "../../test/seed-recipes.js";
import { expandRestrictedTerms, filterRecipesForProfile, findRestrictedTerms, matchesRequiredDiet } from "../../services/dietary.service.js";
import { fallbackPlan, mealSlots, reconcileAIPlan } from "./meal-plan-generator.js";

const recipes = seedRecipesAsRecords();
const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

const dietTypes: DietType[] = ["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"];
const allergySets = [[], ["Hải sản"], ["Sữa"], ["Trứng"], ["Đậu phộng"], ["Gluten"], ["Hải sản", "Trứng", "Sữa", "Đậu phộng"]];
// Kho trống và kho mẫu của tài khoản demo (thứ hạng món thay đổi theo kho).
const pantries = { "kho trống": new Set<string>(), "kho demo": new Set(["ức gà", "bông cải xanh", "trứng", "khoai lang", "gạo"]) };
// 5 chế độ ăn × 7 bộ dị ứng × 2 mức số bữa × 2 kiểu kho = 140 tổ hợp.
const cases = Object.entries(pantries).flatMap(([pantryName, pantry]) => dietTypes.flatMap((dietType) =>
  allergySets.flatMap((allergies) => [3, 4].map((mealsPerDay) => ({ pantryName, pantry, dietType, allergies, mealsPerDay })))));

type Plan = ReturnType<typeof fallbackPlan>;
const recipeCounts = (plan: Plan) => {
  const counts = new Map<string, number>();
  plan.days.forEach((day) => day.meals.forEach((meal) => counts.set(meal.recipeId, (counts.get(meal.recipeId) ?? 0) + 1)));
  return counts;
};
const maxRepeat = (plan: Plan) => Math.max(...recipeCounts(plan).values());
// Số lần món bữa tối hôm trước xuất hiện lại ở bữa sáng/trưa hôm sau.
const crossDayRepeats = (plan: Plan) => plan.days.slice(1).reduce((total, day, index) => {
  const dinner = plan.days[index].meals.find((meal) => meal.mealType === "DINNER")!.recipeId;
  return total + day.meals.filter((meal) => (meal.mealType === "BREAKFAST" || meal.mealType === "LUNCH") && meal.recipeId === dinner).length;
}, 0);

describe("fallbackPlan on the seed recipes", () => {
  it("follows mealsPerDay from the profile", () => {
    expect(mealSlots(3)).toEqual(["BREAKFAST", "LUNCH", "DINNER"]);
    expect(mealSlots(4)).toEqual(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);
  });

  it.each(cases)("builds a valid 7-day plan for $dietType, allergies $allergies, $mealsPerDay meals, $pantryName", ({ pantry, dietType, allergies, mealsPerDay }) => {
    const allowed = filterRecipesForProfile(recipes, { dietType, allergies, dislikedFoods: [] });
    const plan = fallbackPlan(allowed, pantry, mealsPerDay, dietType);
    const restricted = expandRestrictedTerms(allergies);

    expect(plan.days).toHaveLength(7);
    for (const day of plan.days) {
      expect(day.meals.map((meal) => meal.mealType)).toEqual(mealSlots(mealsPerDay));
      for (const meal of day.meals) {
        const recipe = byId.get(meal.recipeId)!;
        // Đúng bữa, đúng chế độ ăn bắt buộc và không chứa thành phần dị ứng.
        expect(recipe.mealTypes, `${recipe.slug} → ${meal.mealType}`).toContain(meal.mealType);
        expect(matchesRequiredDiet(recipe, dietType), recipe.slug).toBe(true);
        expect(findRestrictedTerms(recipe, restricted), recipe.slug).toEqual([]);
      }
      // Không lặp một món trong cùng ngày.
      expect(new Set(day.meals.map((meal) => meal.recipeId)).size).toBe(day.meals.length);
    }
  });

  it.each([3, 4].flatMap((mealsPerDay) => Object.entries(pantries).map(([pantryName, pantry]) => ({ mealsPerDay, pantryName, pantry }))))(
    "never repeats last night's dinner at the next breakfast or lunch (balanced, $mealsPerDay meals, $pantryName)",
    ({ mealsPerDay, pantry }) => {
      const plan = fallbackPlan(recipes, pantry, mealsPerDay, "BALANCED");
      expect(crossDayRepeats(plan)).toBe(0);
      plan.days.slice(1).forEach((day, index) => {
        const dinner = plan.days[index].meals.find((meal) => meal.mealType === "DINNER")!.recipeId;
        expect(day.meals.find((meal) => meal.mealType === "LUNCH")!.recipeId).not.toBe(dinner);
      });
    },
  );

  it("spreads dishes across the week (repeats reduced compared with the old rotation)", () => {
    const demoPantry = pantries["kho demo"];
    // Trước khi sửa (xoay vòng theo ngày): tối đa 2 lần/món, chỉ 15 món khác nhau cho 21 bữa.
    const threeMeals = fallbackPlan(recipes, demoPantry, 3, "BALANCED");
    expect(maxRepeat(threeMeals)).toBe(1);
    expect(recipeCounts(threeMeals).size).toBe(21);
    // 28 bữa nhưng bữa phụ chỉ có 6 món phù hợp: vẫn tối đa 2 lần/món (trước: 2 lần, 20 món khác nhau).
    const fourMeals = fallbackPlan(recipes, demoPantry, 4, "BALANCED");
    expect(maxRepeat(fourMeals)).toBeLessThanOrEqual(2);
    expect(recipeCounts(fourMeals).size).toBeGreaterThan(20);

    // Toàn bộ 140 tổ hợp. Trước khi sửa: lặp tối đa 5 lần, trung bình 3,06; 468 lần lặp tối → sáng/trưa hôm sau.
    const plans = cases.map(({ pantry, dietType, allergies, mealsPerDay }) =>
      fallbackPlan(filterRecipesForProfile(recipes, { dietType, allergies }), pantry, mealsPerDay, dietType));
    const maxima = plans.map(maxRepeat);
    expect(Math.max(...maxima)).toBeLessThanOrEqual(4);
    // Thấp hơn trước khi sửa (3,06); LOW_CARB/HIGH_PROTEIN chủ ý lặp món hợp chế độ nhiều hơn một chút.
    expect(maxima.reduce((sum, value) => sum + value, 0) / maxima.length).toBeLessThan(3.06);
    expect(plans.reduce((total, plan) => total + crossDayRepeats(plan), 0)).toBe(0);
  });

  it("still builds a full week from a very small list, repeating only when unavoidable", () => {
    // Chỉ 2 món cho mọi bữa (mealTypes rỗng): vẫn đủ 7 ngày × 3 bữa, không lặp trong ngày khi còn món khác.
    const tiny = recipes.slice(0, 2).map((recipe) => ({ ...recipe, mealTypes: [] }));
    const plan = fallbackPlan(tiny, new Set(), 3, "BALANCED");
    expect(plan.days).toHaveLength(7);
    expect(plan.days.every((day) => day.meals.length === 3)).toBe(true);
    expect(plan.days.every((day) => new Set(day.meals.map((meal) => meal.recipeId)).size === 2)).toBe(true);
  });

  it("varies dishes across the week", () => {
    const plan = fallbackPlan(recipes, new Set(), 3, "BALANCED");
    const lunches = new Set(plan.days.map((day) => day.meals.find((meal) => meal.mealType === "LUNCH")!.recipeId));
    expect(lunches.size).toBeGreaterThanOrEqual(5);
  });

  it("prefers low-carb dishes for low-carb users without excluding others", () => {
    const plan = fallbackPlan(recipes, new Set(), 3, "LOW_CARB");
    const dinners = plan.days.map((day) => byId.get(day.meals.find((meal) => meal.mealType === "DINNER")!.recipeId)!);
    expect(dinners.filter((recipe) => recipe.dietTags.includes("LOW_CARB")).length).toBeGreaterThanOrEqual(3);
    expect(filterRecipesForProfile(recipes, { dietType: "LOW_CARB" })).toHaveLength(recipes.length);
  });

  it("puts dishes using pantry ingredients first", () => {
    const pantry = new Set(["đậu hũ", "cà chua", "gạo"]);
    const plan = fallbackPlan(recipes, pantry, 3, "BALANCED");
    const lunch = byId.get(plan.days[0].meals.find((meal) => meal.mealType === "LUNCH")!.recipeId)!;
    const pantryMatches = lunch.ingredients.filter((ingredient) => pantry.has(ingredient.name.toLocaleLowerCase("vi"))).length;
    expect(pantryMatches).toBe(3);
  });
});

describe("reconcileAIPlan (kiểm tra kết quả OpenAI)", () => {
  const seafoodFree = filterRecipesForProfile(recipes, { dietType: "BALANCED", allergies: ["Hải sản"] });
  const noPantry = new Set<string>();
  // Thực đơn AI hợp lệ làm nền, mỗi test chèn một kiểu vi phạm.
  const validAIPlan = () => ({ ...fallbackPlan(seafoodFree, noPantry, 3), summary: "Thực đơn do AI đề xuất" });
  const mealOf = (plan: ReturnType<typeof validAIPlan>, dayIndex: number, mealType: string) =>
    plan.days.find((day) => day.dayIndex === dayIndex)!.meals.find((meal) => meal.mealType === mealType)!;

  it("keeps a valid AI plan unchanged", () => {
    const aiPlan = validAIPlan();
    const result = reconcileAIPlan(aiPlan, seafoodFree, noPantry, 3);
    expect(result).toMatchObject({ source: "ai", replacedMeals: 0 });
    expect(result.plan).toEqual(aiPlan);
  });

  it("replaces a dish served at the wrong meal with a valid dish for that meal", () => {
    const aiPlan = validAIPlan();
    mealOf(aiPlan, 0, "LUNCH").recipeId = "che-dau-den"; // chè chỉ dành cho bữa phụ
    const result = reconcileAIPlan(aiPlan, seafoodFree, noPantry, 3);
    const lunch = byId.get(mealOf(result.plan, 0, "LUNCH").recipeId)!;
    expect(result).toMatchObject({ source: "ai-corrected", replacedMeals: 1 });
    expect(lunch.mealTypes).toContain("LUNCH");
    expect(mealOf(result.plan, 0, "BREAKFAST")).toEqual(mealOf(aiPlan, 0, "BREAKFAST"));
    expect(result.plan.summary).toBe("Thực đơn do AI đề xuất");
  });

  it("replaces a dish containing an allergen or missing from the filtered list", () => {
    const aiPlan = validAIPlan();
    mealOf(aiPlan, 2, "DINNER").recipeId = "ca-kho-to"; // chứa cá và nước mắm, người dùng dị ứng hải sản
    mealOf(aiPlan, 3, "LUNCH").recipeId = "recipe-does-not-exist";
    const result = reconcileAIPlan(aiPlan, seafoodFree, noPantry, 3);
    expect(result).toMatchObject({ source: "ai-corrected", replacedMeals: 2 });
    for (const [dayIndex, mealType] of [[2, "DINNER"], [3, "LUNCH"]] as const) {
      const recipe = byId.get(mealOf(result.plan, dayIndex, mealType).recipeId)!;
      expect(findRestrictedTerms(recipe, expandRestrictedTerms(["Hải sản"]))).toEqual([]);
      expect(recipe.mealTypes).toContain(mealType);
    }
  });

  it("fills a missing meal and replaces a dish repeated within the same day", () => {
    const aiPlan = validAIPlan();
    const day = aiPlan.days[1];
    day.meals = day.meals.filter((meal) => meal.mealType !== "DINNER");
    mealOf(aiPlan, 4, "DINNER").recipeId = mealOf(aiPlan, 4, "LUNCH").recipeId;
    const result = reconcileAIPlan(aiPlan, seafoodFree, noPantry, 3);
    expect(result.replacedMeals).toBe(2);
    expect(result.plan.days[1].meals.map((meal) => meal.mealType)).toEqual(mealSlots(3));
    expect(new Set(result.plan.days[4].meals.map((meal) => meal.recipeId)).size).toBe(3);
  });

  it("falls back to the whole fallback plan when a day is missing", () => {
    const aiPlan = validAIPlan();
    aiPlan.days = aiPlan.days.filter((day) => day.dayIndex !== 6);
    const result = reconcileAIPlan(aiPlan, seafoodFree, noPantry, 3);
    expect(result.source).toBe("fallback");
    expect(result.plan).toEqual(fallbackPlan(seafoodFree, noPantry, 3));
  });

  it("falls back to the whole fallback plan when more than half of the meals are invalid", () => {
    const aiPlan = validAIPlan();
    aiPlan.days.slice(0, 4).forEach((day) => day.meals.forEach((meal) => { meal.recipeId = "ca-kho-to"; }));
    expect(reconcileAIPlan(aiPlan, seafoodFree, noPantry, 3).source).toBe("fallback");
  });
});
