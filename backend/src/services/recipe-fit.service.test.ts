import type { DietType, FoodUnit } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateNutritionTargets } from "./nutrition.service.js";
import { calorieShare, matchRecipeToPantry, pantryExpiryState, recipeWarnings, recommendRecipes } from "./recipe-fit.service.js";

const now = new Date("2026-09-15T10:00:00.000Z");
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ing = (name: string, unit: FoodUnit = "G", optional = false) => ({ name, quantity: 100, unit, optional });
const stock = (name: string, expiry: string | null = null, unit: FoodUnit = "G", quantity = 1) => ({
  name, quantity, unit, expiryDate: expiry ? day(expiry) : null,
});
const dish = (name: string, ingredients: string[], dietTags: DietType[] = ["BALANCED"]) => ({
  name, calories: 500, dietTags, ingredients: ingredients.map((item) => ing(item)),
});

describe("pantryExpiryState", () => {
  it("uses the same 3-day UTC window as PANTRY_EXPIRING notifications", () => {
    expect(pantryExpiryState(null, now)).toBe("fresh");
    expect(pantryExpiryState(day("2026-09-14"), now)).toBe("expired");
    expect(pantryExpiryState(day("2026-09-15"), now)).toBe("expiring");
    expect(pantryExpiryState(day("2026-09-18"), now)).toBe("expiring");
    expect(pantryExpiryState(day("2026-09-19"), now)).toBe("fresh");
  });
});

describe("matchRecipeToPantry", () => {
  it("matches by normalized name (case/whitespace) and lists missing ingredients with their optional flag", () => {
    const recipe = { ingredients: [ing("Ức gà"), ing("Hành lá", "G", true), ing("Cà rốt")] };
    const result = matchRecipeToPantry(recipe, [stock("  ức   GÀ ")], now);
    expect(result).toMatchObject({
      totalIngredients: 3,
      inPantry: ["Ức gà"],
      missing: [{ name: "Hành lá", optional: true }, { name: "Cà rốt", optional: false }],
      expiring: [],
      expired: [],
      unitMismatches: [],
    });
  });

  it("does not count expired or empty pantry items as available", () => {
    const recipe = { ingredients: [ing("Sữa tươi"), ing("Trứng")] };
    const result = matchRecipeToPantry(recipe, [stock("Sữa tươi", "2026-09-10"), stock("Trứng", null, "G", 0)], now);
    expect(result.inPantry).toEqual([]);
    expect(result.missing.map((item) => item.name)).toEqual(["Sữa tươi", "Trứng"]);
    expect(result.expired).toEqual(["Sữa tươi"]);
  });

  it("uses a fresh duplicate when another row of the same food has expired", () => {
    const result = matchRecipeToPantry({ ingredients: [ing("Gạo")] }, [stock("Gạo", "2026-09-01"), stock("Gạo", "2026-12-01")], now);
    expect(result).toMatchObject({ inPantry: ["Gạo"], expired: [], expiring: [] });
  });

  it("flags soon-expiring ingredients", () => {
    const result = matchRecipeToPantry({ ingredients: [ing("Ức gà")] }, [stock("Ức gà", "2026-09-17")], now);
    expect(result.expiring).toEqual(["Ức gà"]);
  });

  it("counts an ingredient stored in another unit as available but reports the unit mismatch", () => {
    const result = matchRecipeToPantry({ ingredients: [ing("Trứng", "G")] }, [stock("Trứng", null, "ITEM"), stock("Trứng", null, "ITEM")], now);
    expect(result.inPantry).toEqual(["Trứng"]);
    expect(result.unitMismatches).toEqual([{ name: "Trứng", recipeUnit: "G", pantryUnits: ["ITEM"] }]);
  });
});

describe("calorieShare", () => {
  it("compares one serving with the daily target saved in the profile", () => {
    expect(calorieShare(500, { dailyCalorieTarget: 2000 })).toEqual({ recipeCalories: 500, dailyTarget: 2000, percentOfDailyTarget: 25 });
  });

  it("calculates the target from the profile when none is saved, or from defaults without a profile", () => {
    const profile = { dailyCalorieTarget: null, age: 30, heightCm: 170, weightKg: 65, gender: "MALE" as const };
    expect(calorieShare(600, profile).dailyTarget).toBe(calculateNutritionTargets(profile).calories);
    const fallback = calculateNutritionTargets({}).calories;
    expect(calorieShare(600, null)).toEqual({ recipeCalories: 600, dailyTarget: fallback, percentOfDailyTarget: Math.round((600 / fallback) * 100) });
  });
});

describe("recipeWarnings", () => {
  it("reports allergy groups, disliked foods and a vegetarian conflict", () => {
    const recipe = dish("Cá kho tộ", ["Cá basa", "Nước mắm", "Hành tím"]);
    const warnings = recipeWarnings(recipe, { dietType: "VEGETARIAN", allergies: ["Hải sản"], dislikedFoods: ["hành  TÍM"] });
    expect(warnings.allergens).toEqual(["cá", "nước mắm"]); // "mắm" đã nằm trong "nước mắm" nên không lặp lại
    expect(warnings.dislikedFoods).toEqual(["hành tím"]);
    expect(warnings.dietConflict).toBe("VEGETARIAN");
  });

  it("flags a vegetarian-only dish for a vegan profile and returns no warnings for a balanced profile", () => {
    const omelette = dish("Trứng chiên", ["Trứng"], ["VEGETARIAN"]);
    expect(recipeWarnings(omelette, { dietType: "VEGAN" }).dietConflict).toBe("VEGAN");
    expect(recipeWarnings(omelette, null)).toEqual({ allergens: [], dislikedFoods: [], dietConflict: null });
  });
});

describe("recommendRecipes", () => {
  it("keeps only dishes allowed by the profile", () => {
    const recipes = [dish("Phở bò", ["Thịt bò"]), dish("Đậu hũ sốt cà", ["Đậu hũ"], ["VEGETARIAN", "VEGAN"])];
    expect(recommendRecipes(recipes, { dietType: "VEGETARIAN" }, [], 3, now).map((item) => item.recipe.name)).toEqual(["Đậu hũ sốt cà"]);
  });

  it("ranks expiring-ingredient dishes first, then by pantry ingredients, keeping input order on ties and honoring the limit", () => {
    const recipes = [
      dish("A", ["Tôm"]),
      dish("B", ["Gạo", "Trứng"]),
      dish("C", ["Ức gà"]),
      dish("D", ["Gạo"]),
      dish("E", ["Trứng"]),
    ];
    const pantry = [stock("Ức gà", "2026-09-16"), stock("Gạo", "2026-12-01"), stock("Trứng")];
    const result = recommendRecipes(recipes, null, pantry, 4, now);
    expect(result.map((item) => item.recipe.name)).toEqual(["C", "B", "D", "E"]);
    expect(result[0]).toMatchObject({ totalIngredients: 1, pantryIngredientCount: 1, expiringIngredientCount: 1 });
  });
});
