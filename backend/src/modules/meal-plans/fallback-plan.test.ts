import type { DietType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { seedRecipes } from "../../../prisma/seed-data.js";
import { expandRestrictedTerms, filterRecipesForProfile, findRestrictedTerms, matchesRequiredDiet } from "../../services/dietary.service.js";
import { fallbackPlan, mealSlots, reconcileAIPlan } from "./meal-plans.service.js";

vi.mock("../../lib/prisma.js", () => ({ prisma: {} }));
vi.mock("../ai/ai.service.js", () => ({ generatePlanWithAI: vi.fn() }));

// Bộ món seed thật, gán id theo slug như sau khi đã lưu DB.
const recipes = seedRecipes.map((recipe) => ({
  ...recipe,
  id: recipe.slug,
  servings: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ingredients: recipe.ingredients.map((ingredient, ingredientIndex) => ({
    id: `${recipe.slug}-${ingredientIndex}`, recipeId: recipe.slug, optional: false, ...ingredient,
  })),
}));
const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

const dietTypes: DietType[] = ["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"];
const allergySets = [[], ["Hải sản"], ["Sữa"], ["Trứng"], ["Đậu phộng"], ["Gluten"], ["Hải sản", "Trứng", "Sữa", "Đậu phộng"]];
const cases = dietTypes.flatMap((dietType) => allergySets.flatMap((allergies) => [3, 4].map((mealsPerDay) => ({ dietType, allergies, mealsPerDay }))));

describe("fallbackPlan on the seed recipes", () => {
  it("follows mealsPerDay from the profile", () => {
    expect(mealSlots(3)).toEqual(["BREAKFAST", "LUNCH", "DINNER"]);
    expect(mealSlots(4)).toEqual(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);
  });

  it.each(cases)("builds a valid 7-day plan for $dietType, allergies $allergies, $mealsPerDay meals", ({ dietType, allergies, mealsPerDay }) => {
    const allowed = filterRecipesForProfile(recipes, { dietType, allergies, dislikedFoods: [] });
    const plan = fallbackPlan(allowed, new Set(), mealsPerDay, dietType);
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
