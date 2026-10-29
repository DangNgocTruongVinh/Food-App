import { describe, expect, it } from "vitest";
import { seedCuisines, seedImageGroups, seedRecipes } from "../../../prisma/seed-data.js";
import { expandRestrictedTerms, findRestrictedTerms } from "../../services/dietary.service.js";

const foodUnits = ["G", "KG", "ML", "L", "ITEM", "PACKAGE"];
const mealTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
// Nguyên liệu động vật không được có trong món chay/thuần chay.
const meatAndFish = ["thịt", "sườn", "xương", "gà", "bò", "heo", "đùi gà", "ức gà", ...expandRestrictedTerms(["Hải sản"])];
const animalProducts = [...meatAndFish, ...expandRestrictedTerms(["Sữa", "Trứng"]), "mật ong"];

describe("Seed recipe data", () => {
  it("has 25–35 recipes with unique slugs and names", () => {
    expect(seedRecipes.length).toBeGreaterThanOrEqual(25);
    expect(seedRecipes.length).toBeLessThanOrEqual(35);
    expect(new Set(seedRecipes.map((recipe) => recipe.slug)).size).toBe(seedRecipes.length);
    expect(new Set(seedRecipes.map((recipe) => recipe.name)).size).toBe(seedRecipes.length);
  });

  it("keeps roughly 80% Vietnamese dishes and uses only the agreed cuisine names", () => {
    const vietnamese = seedRecipes.filter((recipe) => recipe.cuisine === "Việt Nam").length / seedRecipes.length;
    expect(vietnamese).toBeGreaterThanOrEqual(0.75);
    expect(vietnamese).toBeLessThanOrEqual(0.85);
    for (const recipe of seedRecipes) expect(seedCuisines).toContain(recipe.cuisine);
  });

  it.each(seedRecipes.map((recipe) => [recipe.slug, recipe] as const))("%s is complete and consistent", (_slug, recipe) => {
    expect(recipe.description.length).toBeGreaterThan(20);
    expect(recipe.instructions.length).toBeGreaterThanOrEqual(4);
    expect(recipe.instructions.length).toBeLessThanOrEqual(7);
    expect(recipe.ingredients.length).toBeGreaterThan(0);
    expect(recipe.mealTypes.length).toBeGreaterThan(0);
    for (const mealType of recipe.mealTypes) expect(mealTypes).toContain(mealType);
    expect(Object.values(seedImageGroups)).toContain(recipe.imageUrl);
    expect(recipe.calories).toBeGreaterThan(0);
    // Năng lượng khai báo gần với năng lượng tính từ đạm/tinh bột/chất béo (4/4/9 kcal mỗi gam), sai lệch tối đa 15%.
    const fromMacros = recipe.proteinG * 4 + recipe.carbsG * 4 + recipe.fatG * 9;
    expect(Math.abs(fromMacros - recipe.calories) / recipe.calories).toBeLessThanOrEqual(0.15);
    for (const ingredient of recipe.ingredients) {
      expect(foodUnits).toContain(ingredient.unit);
      expect(ingredient.quantity).toBeGreaterThan(0);
      // Tên nhập nhằng: dùng "Quả bơ" hoặc "Bơ lạt", không dùng "Bơ" trống.
      expect(ingredient.name.trim().toLocaleLowerCase("vi")).not.toBe("bơ");
    }
  });

  it("labels vegan dishes as vegetarian too", () => {
    for (const recipe of seedRecipes.filter((item) => item.dietTags.includes("VEGAN"))) {
      expect(recipe.dietTags, recipe.slug).toContain("VEGETARIAN");
    }
  });

  it.each(seedRecipes.filter((recipe) => recipe.dietTags.includes("VEGAN")).map((recipe) => [recipe.slug, recipe] as const))(
    "vegan dish %s has no animal products",
    (_slug, recipe) => {
      expect(findRestrictedTerms(recipe, animalProducts)).toEqual([]);
    },
  );

  it.each(seedRecipes.filter((recipe) => recipe.dietTags.includes("VEGETARIAN")).map((recipe) => [recipe.slug, recipe] as const))(
    "vegetarian dish %s has no meat, fish or fish sauce",
    (_slug, recipe) => {
      expect(findRestrictedTerms(recipe, meatAndFish)).toEqual([]);
    },
  );

  it("offers dishes for every meal of the day", () => {
    for (const mealType of mealTypes) {
      expect(seedRecipes.filter((recipe) => recipe.mealTypes.includes(mealType)).length, mealType).toBeGreaterThanOrEqual(5);
    }
  });
});
