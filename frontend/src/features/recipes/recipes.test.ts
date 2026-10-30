import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient, retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { Recipe, RecipeForYou } from "../../types";
import {
  calorieShareLabel, expiringHint, forYouWarnings, missingIngredientItems, pantryCoverage, unitMismatchNote,
} from "./recipe-for-you.logic";
import { getRecipe, getRecipeForYou, listRecipes, normalizeRecipeListParams } from "./recipes.api";
import {
  clampServings, filterAndSortRecipes, formatIngredientAmount, formatScaledIngredientAmount, MAX_RECIPE_SERVINGS,
  roundIngredientQuantity, scaleIngredientQuantity, matchesRecipeCategory, paginateRecipes, recipeDetailPath,
  recipeDietLabel, recipeImage, recipeImageSrc, recipeTotalMinutes,
} from "./recipes.logic";
import { recipeQueries } from "./recipes.queries";

const recipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: "recipe-a",
  name: "Ức gà rau củ",
  description: "Bữa trưa cân bằng",
  instructions: ["Áp chảo thịt gà"],
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 2,
  calories: 420,
  proteinG: 38,
  carbsG: 32,
  fatG: 14,
  fiberG: 7,
  cuisine: "Việt Nam",
  dietTags: ["BALANCED"],
  ingredients: [{ id: "ingredient-a", name: "Bông cải", quantity: 200, unit: "G", optional: false }],
  ...overrides,
});

const recipes = [
  recipe(),
  recipe({
    id: "recipe-b", name: "Yến mạch sữa chua", description: "Bữa sáng nhanh",
    prepMinutes: 3, cookMinutes: 2, calories: 280, proteinG: 14,
    cuisine: "Quốc tế", dietTags: ["VEGETARIAN", "LOW_CARB"],
    ingredients: [{ id: "ingredient-b", name: "Chuối", quantity: 1, unit: "ITEM", optional: true }],
  }),
  recipe({
    id: "recipe-c", name: "Bowl đậu nấm", description: "Món chay",
    prepMinutes: 15, cookMinutes: 25, calories: 360, proteinG: 22,
    cuisine: "Quốc tế", dietTags: ["VEGAN"], ingredients: [],
  }),
];

const forYou: RecipeForYou = {
  recipeId: "recipe-a",
  pantry: {
    totalIngredients: 4, inPantryCount: 1, inPantry: ["Ức gà"],
    missing: [{ name: "Hành lá", optional: true }, { name: "Sữa tươi", optional: false }, { name: "Bông cải", optional: false }],
    expiring: ["Ức gà"], expired: ["Sữa tươi"],
    unitMismatches: [{ name: "Ức gà", recipeUnit: "G", pantryUnits: ["ITEM"] }],
  },
  calories: { recipeCalories: 520, dailyTarget: 2000, percentOfDailyTarget: 26 },
  warnings: { allergens: ["cá", "nước mắm"], dislikedFoods: ["hành tím"], dietConflict: "VEGETARIAN" },
};

const originalAdapter = api.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = createAppQueryClient();
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("sessionStorage", { getItem: () => null });
});

afterEach(() => {
  client.clear();
  api.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
});

describe("Recipes API adapters (no network)", () => {
  it("normalizes list query parameters without sending empty values", () => {
    expect(normalizeRecipeListParams({ search: "  ức gà  ", cuisine: " Việt Nam " }))
      .toEqual({ search: "ức gà", cuisine: "Việt Nam" });
    expect(normalizeRecipeListParams({ search: " ", cuisine: "" })).toEqual({});
  });

  it("lists recipes through the existing endpoint without query parameters", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: recipes, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await listRecipes()).toEqual(recipes);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/recipes" });
    expect(adapter.mock.calls[0][0].params).toBeUndefined();
  });

  it("sends the supported search and cuisine filters", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: [recipes[0]], status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await listRecipes({ search: " Ức gà ", cuisine: " Việt Nam " });
    expect(adapter.mock.calls[0][0]).toMatchObject({
      method: "get", url: "/recipes", params: { search: "Ức gà", cuisine: "Việt Nam" },
    });
  });

  it("gets recipe details through the existing endpoint", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: recipes[0], status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await getRecipe(recipes[0].id)).toEqual(recipes[0]);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: `/recipes/${recipes[0].id}` });
  });

  it("gets the signed-in user's fit for a recipe without sending a userId", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: forYou, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await getRecipeForYou("recipe-a")).toEqual(forYou);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/recipes/recipe-a/for-you" });
    expect(adapter.mock.calls[0][0].params).toBeUndefined();
  });

  it.each(["list", "detail"] as const)("propagates a failed %s request", async (operation) => {
    const failure = new Error(`${operation} failed`);
    api.defaults.adapter = async () => { throw failure; };
    const request = operation === "list" ? listRecipes() : getRecipe(recipes[0].id);
    await expect(request).rejects.toBe(failure);
  });
});

describe("Recipes query definitions", () => {
  it("uses normalized shared keys and caches list responses", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: recipes, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    const options = recipeQueries.list({ search: " ức gà " });
    expect(options.queryKey).toEqual(["recipes", "list", { search: "ức gà" }]);
    expect(await client.fetchQuery(options)).toEqual(recipes);
    expect(await client.fetchQuery(recipeQueries.list({ search: "ức gà" }))).toEqual(recipes);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("uses a distinct shared key for recipe details", () => {
    expect(queryKeys.recipes.all).toEqual(["recipes"]);
    expect(recipeQueries.detail("recipe-a").queryKey).toEqual(["recipes", "detail", "recipe-a"]);
    expect(recipeQueries.forYou("recipe-a").queryKey).toEqual(["recipes", "for-you", "recipe-a"]);
    expect(recipeQueries.forYou("recipe-a").retry).toBe(retryUnlessClientError);
  });
});

describe("Recipes page business logic", () => {
  it("keeps the existing case-insensitive search across name, cuisine and ingredients", () => {
    expect(filterAndSortRecipes(recipes, { search: "  BÔNG CẢI ", category: "all", sort: "newest" }))
      .toEqual([recipes[0]]);
    expect(filterAndSortRecipes(recipes, { search: "quốc tế", category: "all", sort: "newest" }))
      .toEqual([recipes[1], recipes[2]]);
  });

  it.each([
    ["vietnamese", ["recipe-a"]],
    ["international", ["recipe-b", "recipe-c"]],
    ["breakfast", ["recipe-b"]],
    ["healthy", ["recipe-a"]],
    ["low-carb", ["recipe-b"]],
    ["vegetarian", ["recipe-b", "recipe-c"]],
  ] as const)("keeps the existing %s category rule", (category, expectedIds) => {
    expect(recipes.filter((item) => matchesRecipeCategory(item, category)).map((item) => item.id))
      .toEqual(expectedIds);
  });

  it("treats every non-Vietnamese cuisine as international", () => {
    expect(matchesRecipeCategory(recipe({ cuisine: "Ý" }), "international")).toBe(true);
    expect(matchesRecipeCategory(recipe({ cuisine: "Nhật Bản" }), "international")).toBe(true);
    expect(matchesRecipeCategory(recipe({ cuisine: "Việt Nam" }), "international")).toBe(false);
  });

  it("uses mealTypes for the breakfast category when the recipe declares them", () => {
    expect(matchesRecipeCategory(recipe({ name: "Phở bò", mealTypes: ["BREAKFAST", "LUNCH"] }), "breakfast")).toBe(true);
    expect(matchesRecipeCategory(recipe({ name: "Trứng sáng", mealTypes: ["DINNER"] }), "breakfast")).toBe(false);
  });

  it("keeps all four existing sort orders", () => {
    const ids = (sort: "newest" | "quickest" | "calories" | "protein") =>
      filterAndSortRecipes(recipes, { search: "", category: "all", sort }).map((item) => item.id);
    expect(ids("newest")).toEqual(["recipe-a", "recipe-b", "recipe-c"]);
    expect(ids("quickest")).toEqual(["recipe-b", "recipe-a", "recipe-c"]);
    expect(ids("calories")).toEqual(["recipe-b", "recipe-c", "recipe-a"]);
    expect(ids("protein")).toEqual(["recipe-a", "recipe-c", "recipe-b"]);
  });

  it("keeps page size slicing and clamps a page beyond the final page", () => {
    expect(paginateRecipes(recipes, 2, 2)).toEqual({
      totalPages: 2, currentPage: 2, visibleRecipes: [recipes[2]],
    });
    expect(paginateRecipes(recipes, 8, 2)).toEqual({
      totalPages: 2, currentPage: 2, visibleRecipes: [recipes[2]],
    });
  });

  it("keeps the existing local image selection rules", () => {
    expect(recipeImage("Yến mạch chuối")).toBe("/assets/recipe-oats.jpg");
    expect(recipeImage("Cá ngừ")).toBe("/assets/recipe-salmon.jpg");
    expect(recipeImage("Bowl rau nấm")).toBe("/assets/recipe-vegan-bowl.jpg");
    expect(recipeImage("Ức gà")).toBe("/assets/nutrition-hero.jpg");
  });
});

describe("Recipe detail helpers", () => {
  it("prefers an uploaded imageUrl and falls back to the local image by name", () => {
    expect(recipeImageSrc({ name: "Cá ngừ", imageUrl: "https://cdn.example/ca-ngu.jpg" })).toBe("https://cdn.example/ca-ngu.jpg");
    expect(recipeImageSrc({ name: "Cá ngừ", imageUrl: null })).toBe("/assets/recipe-salmon.jpg");
    expect(recipeImageSrc({ name: "Cá ngừ", imageUrl: "" })).toBe("/assets/recipe-salmon.jpg");
    expect(recipeImageSrc({ name: "Cá ngừ" })).toBe("/assets/recipe-salmon.jpg");
  });
  it("builds the detail path and summary values", () => {
    expect(recipeDetailPath("recipe-a")).toBe("/recipes/recipe-a");
    expect(recipeTotalMinutes(recipe())).toBe(30);
    expect(recipeDietLabel("HIGH_PROTEIN")).toBe("HIGH PROTEIN");
  });
  it.each([
    [{ quantity: 200, unit: "G" }, "200 g"],
    [{ quantity: 1.5, unit: "KG" }, "1,5 kg"],
    [{ quantity: 0.333, unit: "L" }, "0,33 lít"],
    [{ quantity: 2, unit: "ITEM" }, "2 cái"],
    [{ quantity: 1, unit: "PACKAGE" }, "1 gói"],
  ] as const)("formats ingredient amount %o as %s", (ingredient, text) => {
    expect(formatIngredientAmount(ingredient)).toBe(text);
  });
  it("does not retry recipe details for client errors such as 404", () => {
    expect(recipeQueries.detail("recipe-a").retry).toBe(retryUnlessClientError);
  });
});

describe("Recipe \"Dành cho bạn\" helpers", () => {
  it("summarizes pantry coverage", () => {
    expect(pantryCoverage(forYou.pantry)).toEqual({ label: "1/4", percent: 25 });
    expect(pantryCoverage({ ...forYou.pantry, totalIngredients: 0, inPantryCount: 0 })).toEqual({ label: "0/0", percent: 0 });
  });
  it("lists required missing ingredients first and marks optional or expired ones", () => {
    expect(missingIngredientItems(forYou.pantry)).toEqual([
      { name: "Sữa tươi", note: "trong kho đã hết hạn" },
      { name: "Bông cải", note: "" },
      { name: "Hành lá", note: "tùy chọn" },
    ]);
  });
  it("suggests cooking soon only when the recipe uses expiring pantry items", () => {
    expect(expiringHint(["Ức gà", "Cà chua"])).toBe("Ức gà, Cà chua trong kho sắp hết hạn. Nên nấu món này sớm.");
    expect(expiringHint([])).toBeNull();
  });
  it("explains the name-only comparison only when units differ", () => {
    expect(unitMismatchNote(forYou.pantry.unitMismatches)).toBe("Chỉ so theo tên nguyên liệu, chưa so được số lượng (khác đơn vị: Ức gà).");
    expect(unitMismatchNote([])).toBeNull();
  });
  it("formats the calorie share", () => {
    expect(calorieShareLabel(forYou.calories)).toBe("520 / 2.000 kcal mục tiêu ngày");
  });
  it("turns profile conflicts into warnings and returns none when everything fits", () => {
    expect(forYouWarnings(forYou.warnings)).toEqual([
      { kind: "allergen", text: "Có thành phần bạn dị ứng: cá, nước mắm" },
      { kind: "disliked", text: "Có món bạn không thích: hành tím" },
      { kind: "diet", text: "Không hợp chế độ Ăn chay của bạn" },
    ]);
    expect(forYouWarnings({ allergens: [], dislikedFoods: [], dietConflict: "VEGAN" })).toEqual([
      { kind: "diet", text: "Không hợp chế độ Thuần chay của bạn" },
    ]);
    expect(forYouWarnings({ allergens: [], dislikedFoods: [], dietConflict: null })).toEqual([]);
  });
});

describe("Recipe servings scaling", () => {
  it("keeps servings between 1 and 12, or the recipe's own servings when larger", () => {
    expect(MAX_RECIPE_SERVINGS).toBe(12);
    expect(clampServings(0, 2)).toBe(1);
    expect(clampServings(13, 2)).toBe(12);
    expect(clampServings(16, 16)).toBe(16);
    expect(clampServings(3.4, 2)).toBe(3);
  });
  it.each([
    [150 * 1.5, "G", 225],
    [12.6, "G", 13],
    [0.5, "G", 0.5],
    [0.04, "ML", 0.1],
    [0.333, "KG", 0.33],
    [1.26, "L", 1.26],
    [1.3, "ITEM", 1.5],
    [1.2, "ITEM", 1],
    [0.2, "ITEM", 0.5],
    [2.75, "PACKAGE", 3],
    [0, "G", 0],
  ] as const)("rounds %d %s to %d", (quantity, unit, expected) => {
    expect(roundIngredientQuantity(quantity, unit)).toBe(expected);
  });
  it("scales by the servings ratio and keeps the original amount when servings are unchanged", () => {
    expect(scaleIngredientQuantity({ quantity: 150, unit: "G" }, 1, 3)).toBe(450);
    expect(scaleIngredientQuantity({ quantity: 300, unit: "G" }, 2, 1)).toBe(150);
    expect(scaleIngredientQuantity({ quantity: 1, unit: "ITEM" }, 2, 3)).toBe(1.5);
    expect(scaleIngredientQuantity({ quantity: 1, unit: "ITEM" }, 4, 1)).toBe(0.5);
    expect(scaleIngredientQuantity({ quantity: 0.333, unit: "L" }, 1, 1)).toBe(0.333);
  });
  it("formats scaled amounts with the shared unit labels", () => {
    expect(formatScaledIngredientAmount({ quantity: 1, unit: "ITEM" }, 2, 3)).toBe("1,5 cái");
    expect(formatScaledIngredientAmount({ quantity: 5, unit: "ML" }, 1, 4)).toBe("20 ml");
    expect(formatScaledIngredientAmount({ quantity: 1.5, unit: "KG" }, 2, 5)).toBe("3,75 kg");
  });
});
