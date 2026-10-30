import { describe, expect, it } from "vitest";
import {
  expandRestrictedTerms, filterRecipesForProfile, findDietViolations, findRestrictedTerms, matchesRequiredDiet, normalizeDietTags,
  normalizeFoodText, prefersDiet,
} from "./dietary.service.js";

const recipe = (name: string, ingredients: string[], dietTags: Array<"BALANCED" | "VEGETARIAN" | "VEGAN" | "LOW_CARB" | "HIGH_PROTEIN"> = ["BALANCED"]) => ({
  name, dietTags, ingredients: ingredients.map((ingredientName) => ({ name: ingredientName })),
});

describe("normalizeFoodText", () => {
  it("ignores case and extra whitespace but keeps Vietnamese accents", () => {
    expect(normalizeFoodText("  Hải   SẢN ")).toBe("hải sản");
    expect(normalizeFoodText("Cá")).not.toBe(normalizeFoodText("Cà"));
  });
});

describe("allergy groups", () => {
  it.each([
    ["Hải sản", ["Tôm", "Cá lóc", "Mực ống", "Nước mắm"]],
    ["hải  sản", ["Cua"]],
    ["Sữa", ["Sữa tươi", "Sữa chua", "Phô mai feta", "Bơ lạt", "Sữa đặc"]],
    ["Trứng", ["Trứng", "Trứng vịt"]],
    ["Đậu phộng", ["Đậu phộng"]],
    ["Lạc", ["Lạc rang"]],
    ["Gluten", ["Bánh mì", "Mì Ý", "Bột mì"]],
  ])("%s excludes recipes containing %j", (allergy, ingredients) => {
    const terms = expandRestrictedTerms([allergy]);
    for (const ingredient of ingredients) {
      expect(findRestrictedTerms(recipe("Món thử", [ingredient]), terms)).not.toHaveLength(0);
    }
  });

  it.each([
    ["Sữa", "Sữa đậu nành"],
    ["Sữa", "Quả bơ"],
    ["Hải sản", "Cà chua"],
    ["Hải sản", "Bánh quốc"],
    ["Đậu phộng", "Đậu hũ"],
    ["Gluten", "Bún tươi"],
    ["Gluten", "Bánh phở"],
  ])("%s does not exclude the unrelated ingredient %s", (allergy, ingredient) => {
    expect(findRestrictedTerms(recipe("Món thử", [ingredient]), expandRestrictedTerms([allergy]))).toEqual([]);
  });

  it("matches a non-group allergy or disliked food as a whole word in the recipe name or ingredients", () => {
    const terms = expandRestrictedTerms(["  Cần TÂY ", "tôm"]);
    expect(findRestrictedTerms(recipe("Canh cần tây", ["Thịt bò"]), terms)).toEqual(["cần tây"]);
    expect(findRestrictedTerms(recipe("Canh bí đỏ nấu tôm", ["Bí đỏ"]), terms)).toEqual(["tôm"]);
    expect(findRestrictedTerms(recipe("Gà xào", ["Đùi gà"]), terms)).toEqual([]);
  });
});

describe("diet rules", () => {
  it("requires vegetarian and vegan tags, and treats vegan dishes as vegetarian", () => {
    expect(matchesRequiredDiet(recipe("Gà", [], ["BALANCED"]), "VEGETARIAN")).toBe(false);
    expect(matchesRequiredDiet(recipe("Trứng", [], ["VEGETARIAN"]), "VEGETARIAN")).toBe(true);
    expect(matchesRequiredDiet(recipe("Đậu hũ", [], ["VEGAN"]), "VEGETARIAN")).toBe(true);
    expect(matchesRequiredDiet(recipe("Trứng", [], ["VEGETARIAN"]), "VEGAN")).toBe(false);
  });
  it("never filters out dishes for balanced, low-carb or high-protein users", () => {
    for (const dietType of ["BALANCED", "LOW_CARB", "HIGH_PROTEIN"] as const) {
      expect(matchesRequiredDiet(recipe("Cơm", [], ["BALANCED"]), dietType)).toBe(true);
    }
  });
  it("only prefers dishes for low-carb and high-protein users", () => {
    expect(prefersDiet(recipe("Bò", [], ["LOW_CARB"]), "LOW_CARB")).toBe(true);
    expect(prefersDiet(recipe("Bò", [], ["HIGH_PROTEIN"]), "HIGH_PROTEIN")).toBe(true);
    expect(prefersDiet(recipe("Cơm", [], ["BALANCED"]), "LOW_CARB")).toBe(false);
    expect(prefersDiet(recipe("Chay", [], ["VEGAN"]), "VEGAN")).toBe(false);
  });
  it("combines diet, allergies and disliked foods", () => {
    const recipes = [
      recipe("Đậu hũ sốt cà", ["Đậu hũ", "Cà chua"], ["VEGAN", "VEGETARIAN"]),
      recipe("Trứng chiên", ["Trứng"], ["VEGETARIAN"]),
      recipe("Canh chua chay", ["Đậu hũ", "Cần tây"], ["VEGAN", "VEGETARIAN"]),
      recipe("Cá kho", ["Cá basa"], ["BALANCED"]),
    ];
    const allowed = filterRecipesForProfile(recipes, { dietType: "VEGETARIAN", allergies: ["Trứng"], dislikedFoods: ["cần tây"] });
    expect(allowed.map((item) => item.name)).toEqual(["Đậu hũ sốt cà"]);
    expect(filterRecipesForProfile(recipes, null)).toHaveLength(4);
  });
});

describe("vegetarian / vegan labels (shared by seed data tests and the Admin recipe API)", () => {
  const withIngredients = (dietTags: Array<"BALANCED" | "VEGETARIAN" | "VEGAN">, names: string[]) => ({
    dietTags, ingredients: names.map((name) => ({ name })),
  });

  it("adds VEGETARIAN to a vegan dish and removes duplicate tags", () => {
    expect(normalizeDietTags(["VEGAN"])).toEqual(["VEGAN", "VEGETARIAN"]);
    expect(normalizeDietTags(["BALANCED", "BALANCED", "LOW_CARB"])).toEqual(["BALANCED", "LOW_CARB"]);
  });

  it("lists the meat, fish or fish sauce ingredients of a vegetarian dish", () => {
    expect(findDietViolations(withIngredients(["VEGETARIAN"], ["Đậu hũ", "Thịt heo xay", "Nước mắm", "Trứng"]))).toEqual([
      { ingredient: "Thịt heo xay", terms: ["thịt", "heo"], dietTag: "VEGETARIAN" },
      { ingredient: "Nước mắm", terms: ["nước mắm", "mắm"], dietTag: "VEGETARIAN" },
    ]);
  });

  it("also rejects milk, eggs and honey in a vegan dish", () => {
    expect(findDietViolations(withIngredients(["VEGAN", "VEGETARIAN"], ["Sữa tươi", "Trứng gà", "Mật ong", "Sữa đậu nành"]))
      .map((violation) => violation.ingredient)).toEqual(["Sữa tươi", "Trứng gà", "Mật ong"]);
  });

  it("accepts valid vegetarian dishes and ignores dishes without a vegetarian label", () => {
    expect(findDietViolations(withIngredients(["VEGETARIAN"], ["Đậu hũ", "Cà chua", "Nước tương", "Trứng"]))).toEqual([]);
    expect(findDietViolations(withIngredients(["BALANCED"], ["Thịt bò"]))).toEqual([]);
  });
});
