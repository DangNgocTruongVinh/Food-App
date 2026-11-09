import { describe, expect, it } from "vitest";
import { seedRecipesAsRecords } from "../../test/seed-recipes.js";
import { pickSwapRecipe, shoppingChangesForSwap } from "./meal-swap.js";

const recipes = seedRecipesAsRecords().map((recipe) => ({ ...recipe, hiddenAt: null as Date | null }));
const bySlug = (slug: string) => recipes.find((recipe) => recipe.slug === slug)!;
const noUsage = { sameDay: new Set<string>(), planCounts: new Map<string, number>() };
const seafoodAllergy = { dietType: "BALANCED" as const, allergies: ["Hải sản"], dislikedFoods: [] };

describe("pickSwapRecipe (đổi món, GĐ3b-R2)", () => {
  const current = bySlug("canh-chua-ca-loc");
  const slot = { recipeId: current.id, calories: current.calories, mealType: "LUNCH" as const };

  it("picks a safe recipe for the same meal, never the current one", () => {
    const picked = pickSwapRecipe(recipes, seafoodAllergy, slot, noUsage)!;
    expect(picked.id).not.toBe(current.id);
    expect(picked.ingredients.map((ingredient) => ingredient.name.toLocaleLowerCase("vi")).some((name) => /^(cá|tôm|nước mắm)/.test(name))).toBe(false);
    expect(!picked.mealTypes.length || picked.mealTypes.includes("LUNCH")).toBe(true);
  });

  it("prefers the closest calories, with each use in the plan costing like 100 kcal", () => {
    const first = pickSwapRecipe(recipes, seafoodAllergy, slot, noUsage)!;
    const again = pickSwapRecipe(recipes, seafoodAllergy, slot, { sameDay: new Set(), planCounts: new Map([[first.id, 3]]) })!;
    expect(again.id).not.toBe(first.id);
  });

  it("avoids recipes already eaten that day unless nothing else is left", () => {
    const first = pickSwapRecipe(recipes, seafoodAllergy, slot, noUsage)!;
    expect(pickSwapRecipe(recipes, seafoodAllergy, slot, { sameDay: new Set([first.id]), planCounts: new Map() })!.id).not.toBe(first.id);
    const onlyOne = [current, first];
    expect(pickSwapRecipe(onlyOne, seafoodAllergy, slot, { sameDay: new Set([first.id]), planCounts: new Map() })!.id).toBe(first.id);
  });

  it("skips hidden recipes and returns null when no safe recipe is left", () => {
    const first = pickSwapRecipe(recipes, seafoodAllergy, slot, noUsage)!;
    const hidden = recipes.map((recipe) => (recipe.id === first.id ? { ...recipe, hiddenAt: new Date(0) } : recipe));
    expect(pickSwapRecipe(hidden, seafoodAllergy, slot, noUsage)!.id).not.toBe(first.id);
    expect(pickSwapRecipe([current], seafoodAllergy, slot, noUsage)).toBeNull();
  });
});

describe("shoppingChangesForSwap", () => {
  const oldRecipe = { servings: 2, ingredients: [{ name: "Cá lóc", quantity: 400, unit: "G" as const }, { name: "Cà chua", quantity: 2, unit: "ITEM" as const }] };
  const newRecipe = { servings: 1, ingredients: [{ name: "Đậu hũ", quantity: 200, unit: "G" as const }, { name: "cà chua", quantity: 1, unit: "ITEM" as const }] };
  const shopping = [
    { id: "s-fish", name: "Cá lóc", quantity: 200, unit: "G" as const, purchased: false },
    { id: "s-tomato", name: "Cà chua", quantity: 3, unit: "ITEM" as const, purchased: false },
    { id: "s-bought", name: "Đậu hũ", quantity: 100, unit: "G" as const, purchased: true },
  ];

  it("removes the old meal's share (by meal servings), adds the new one and keeps purchased lines untouched", () => {
    // 1 khẩu phần: cá 200 g (hết dòng → xóa), cà chua −1 +1; đậu hũ: dòng đã mua giữ nguyên, tạo dòng thiếu so với kho.
    expect(shoppingChangesForSwap(oldRecipe, newRecipe, 1, shopping, [{ name: "đậu hũ", quantity: 50, unit: "G" }])).toEqual([
      { kind: "delete", id: "s-fish" },
      { kind: "update", id: "s-tomato", quantity: 3 },
      { kind: "create", name: "Đậu hũ", quantity: 150, unit: "G" },
    ]);
  });

  it("does not create a line when the pantry already covers the new ingredient", () => {
    const changes = shoppingChangesForSwap(oldRecipe, newRecipe, 1, [], [{ name: "Đậu hũ", quantity: 300, unit: "G" }, { name: "Cà chua", quantity: 5, unit: "ITEM" }]);
    expect(changes).toEqual([]);
  });
});
