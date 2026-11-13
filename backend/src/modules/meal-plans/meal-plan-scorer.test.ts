import type { DietType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { expandRestrictedTerms, filterRecipesForProfile, findRestrictedTerms, matchesRequiredDiet } from "../../services/dietary.service.js";
import { seedRecipesAsRecords } from "../../test/seed-recipes.js";
import type { Interaction } from "../recommendation/interactions.js";
import { fallbackPlan, mealSlots } from "./meal-plan-generator.js";
import { REPEAT_WINDOW_DAYS, scoredPlan } from "./meal-plan-scorer.js";

const recipes = seedRecipesAsRecords();
const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

// Hồ sơ "khan món": có bữa chưa tới 2 món đúng bữa (chay/thuần chay + dị ứng gluten: món mặn đều có nước tương, sửa lỗi thành phần ẩn
// 13/11/2026). Bộ tạo vẫn xếp đủ bữa bằng món an toàn (cho lặp trong ngày, lấy món khác bữa — quy tắc có sẵn), nên chỉ kiểm an toàn.
const isScarce = (allowed: Array<{ mealTypes: string[] }>, mealsPerDay: number) =>
  mealSlots(mealsPerDay).some((slot) => allowed.filter((recipe) => recipe.mealTypes.includes(slot)).length < 2);
const start = new Date("2026-10-01T00:00:00.000Z");
const day = 86_400_000;
const at = (offset: number) => new Date(start.getTime() + offset * day);
const baseProfile = {
  dietType: "BALANCED" as DietType, allergies: [] as string[], dislikedFoods: [] as string[], preferredCuisines: ["Việt Nam"],
  mealsPerDay: 3, dailyCalorieTarget: 2000, proteinTargetG: 100,
};
type Profile = typeof baseProfile;
type Pantry = Parameters<typeof scoredPlan>[0]["pantry"];

const plan = (profile: Profile, pantry: Pantry = [], history: Interaction[] = []) => scoredPlan({
  recipes: filterRecipesForProfile(recipes, profile), catalog: recipes, profile, mealsPerDay: profile.mealsPerDay, pantry, history, startDate: start,
});
type Plan = ReturnType<typeof plan>;
const recipeIds = (result: Plan) => result.days.flatMap((planDay) => planDay.meals.map((meal) => meal.recipeId));
/** Số bữa lặp một món đã có trong cửa sổ 3 ngày (cùng ngày hoặc 2 ngày trước). */
const windowRepeats = (result: Plan) => result.days.reduce((total, planDay) => total + planDay.meals.filter((meal, index) =>
  planDay.meals.slice(0, index).some((other) => other.recipeId === meal.recipeId)
  || result.days.slice(Math.max(0, planDay.dayIndex - REPEAT_WINDOW_DAYS + 1), planDay.dayIndex)
    .some((previous) => previous.meals.some((other) => other.recipeId === meal.recipeId))).length, 0);
const dailyCalorieGap = (result: Plan, target: number) => result.days
  .map((planDay) => Math.abs(planDay.meals.reduce((sum, meal) => sum + byId.get(meal.recipeId)!.calories, 0) - target) / target)
  .reduce((sum, gap) => sum + gap, 0) / result.days.length;
const tofu = (quantity: number, expiresInDays: number): Pantry => [{
  id: "tofu", name: "Đậu hũ", quantity, unit: "G", expiryDate: at(expiresInDays), createdAt: at(-1),
}];
const tofuMeals = (result: Plan) => result.days.flatMap((planDay) => planDay.meals
  .filter((meal) => meal.reason.includes("Đậu hũ")).map((meal) => ({ dayIndex: planDay.dayIndex, recipeId: meal.recipeId })));

describe("scoredPlan (GĐ3b-R8): knowledge-based score + 0.3 × content-based", () => {
  const dietTypes: DietType[] = ["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"];
  const allergySets = [[], ["Hải sản"], ["Sữa"], ["Trứng"], ["Đậu phộng"], ["Gluten"], ["Hải sản", "Trứng", "Sữa", "Đậu phộng"]];
  const cases = dietTypes.flatMap((dietType) => allergySets.flatMap((allergies) => [3, 4].map((mealsPerDay) => ({ dietType, allergies, mealsPerDay }))));

  it.each(cases)("builds a safe 7-day plan for $dietType, allergies $allergies, $mealsPerDay meals", ({ dietType, allergies, mealsPerDay }) => {
    const result = plan({ ...baseProfile, dietType, allergies, mealsPerDay }, tofu(300, 1));
    const restricted = expandRestrictedTerms(allergies);
    const scarce = isScarce(filterRecipesForProfile(recipes, { dietType, allergies }), mealsPerDay);
    expect(result.days).toHaveLength(7);
    for (const planDay of result.days) {
      expect(planDay.meals.map((meal) => meal.mealType)).toEqual(mealSlots(mealsPerDay));
      if (!scarce) expect(new Set(planDay.meals.map((meal) => meal.recipeId)).size).toBe(planDay.meals.length);
      for (const meal of planDay.meals) {
        const recipe = byId.get(meal.recipeId)!;
        if (!scarce) expect(recipe.mealTypes).toContain(meal.mealType);
        expect(matchesRequiredDiet(recipe, dietType), recipe.slug).toBe(true);
        expect(findRestrictedTerms(recipe, restricted), recipe.slug).toEqual([]);
      }
    }
  });

  it("never repeats a dish within 3 days when other dishes fit (balanced, vegetarian, 3 meals)", () => {
    expect(windowRepeats(plan(baseProfile))).toBe(0);
    expect(windowRepeats(plan({ ...baseProfile, dietType: "VEGETARIAN" }, tofu(300, 2)))).toBe(0);
  });

  it("uses an expiring item only up to the quantity in the pantry, and only on days before it expires", () => {
    // 200 g đậu hũ hết hạn sau 1 ngày: món dùng đậu hũ cần 50–200 g → chỉ 1–2 bữa được tính là "dùng đồ sắp hết hạn".
    const small = tofuMeals(plan({ ...baseProfile, dietType: "VEGETARIAN" }, tofu(200, 1)));
    expect(small.length).toBeGreaterThanOrEqual(1);
    const needed = (recipeId: string) => byId.get(recipeId)!.ingredients.find((ingredient) => ingredient.name === "Đậu hũ")!.quantity;
    // Mọi bữa được thưởng trừ bữa cuối đều dùng hết phần của mình, nên tổng các bữa trước bữa cuối < 200 g.
    expect(small.slice(0, -1).reduce((sum, meal) => sum + needed(meal.recipeId), 0)).toBeLessThan(200);
    expect(small.every((meal) => meal.dayIndex <= 1)).toBe(true);
    // Nhiều đậu hũ hơn → nhiều bữa dùng đậu hũ hơn (vẫn chỉ trong 2 ngày trước hạn).
    const large = tofuMeals(plan({ ...baseProfile, dietType: "VEGETARIAN" }, tofu(2000, 1)));
    expect(large.length).toBeGreaterThan(small.length);
    expect(large.every((meal) => meal.dayIndex <= 1)).toBe(true);
  });

  it("does not reward an item that has already expired at the start of the plan", () => {
    expect(tofuMeals(plan({ ...baseProfile, dietType: "VEGETARIAN" }, tofu(2000, -1)))).toEqual([]);
  });

  it.each(dietTypes)("matches daily calories more closely than the old generator (%s, 2000 kcal)", (dietType) => {
    const profile = { ...baseProfile, dietType };
    const old = fallbackPlan(filterRecipesForProfile(recipes, profile), new Set(), 3, dietType);
    expect(dailyCalorieGap(plan(profile), 2000)).toBeLessThan(dailyCalorieGap(old as Plan, 2000));
  });

  it("follows the user's history (content-based part): more international dishes after eating them often", () => {
    const international = ["ga-teriyaki", "mi-y-sot-bo-bam", "com-tron-han-quoc", "salad-hy-lap"];
    const history: Interaction[] = international.map((recipeId) => ({ userId: "u", recipeId, kind: "EATEN", at: at(-10), count: 4 }));
    const count = (result: Plan) => recipeIds(result).filter((id) => byId.get(id)!.cuisine !== "Việt Nam").length;
    const profile = { ...baseProfile, preferredCuisines: [] };
    expect(count(plan(profile, [], history))).toBeGreaterThan(count(plan(profile)));
  });

  it("does not plan a dish eaten in the last 2 days before the plan at the start of the week", () => {
    const eaten = plan(baseProfile).days[0].meals.map((meal) => meal.recipeId);
    const history: Interaction[] = eaten.map((recipeId) => ({ userId: "u", recipeId, kind: "EATEN", at: at(-1), count: 1 }));
    const first = plan(baseProfile, [], history).days[0].meals.map((meal) => meal.recipeId);
    expect(first.filter((id) => eaten.includes(id))).toEqual([]);
  });
});
