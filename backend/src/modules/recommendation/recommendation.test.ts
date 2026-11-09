import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import { seedRecipesAsRecords } from "../../test/seed-recipes.js";
import recommendationRoutes from "./recommendation.routes.js";
import { clearRecommendationCache } from "./recommendation.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findRecipes: vi.fn(), findRecipe: vi.fn(), findProfile: vi.fn(), findPantry: vi.fn(), findPantryItem: vi.fn(),
  findMealItems: vi.fn(), queryRaw: vi.fn(),
}));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    recipe: { findMany: mocks.findRecipes, findUnique: mocks.findRecipe },
    nutritionProfile: { findUnique: mocks.findProfile },
    pantryItem: { findMany: mocks.findPantry, findFirst: mocks.findPantryItem },
    mealPlanItem: { findMany: mocks.findMealItems },
    $queryRaw: mocks.queryRaw,
  },
}));

const app = testApp("/api/recommendations", recommendationRoutes);
const userId = "cm11111111111111111111111";
const recipeId = "cm22222222222222222222222";
const pantryItemId = "cm33333333333333333333333";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "demo@nouri.vn" }, mocks.secret)}`;
const get = (query: string) => request(app, `/api/recommendations${query}`, { token: token() });
const recipes = seedRecipesAsRecords();

beforeEach(() => {
  vi.resetAllMocks();
  clearRecommendationCache();
  mocks.findRecipes.mockResolvedValue(recipes);
  mocks.findRecipe.mockResolvedValue({ id: recipes[0].id });
  mocks.findProfile.mockResolvedValue({ userId, dietType: "BALANCED", allergies: ["Hải sản"], dislikedFoods: [], preferredCuisines: [] });
  mocks.findPantry.mockResolvedValue([]);
  mocks.findPantryItem.mockResolvedValue(null);
  mocks.findMealItems.mockResolvedValue([]);
  mocks.queryRaw.mockResolvedValue([]);
});
afterEach(() => vi.restoreAllMocks());

describe("GET /api/recommendations", () => {
  it("requires authentication", async () => {
    expect((await request(app, "/api/recommendations?context=today")).status).toBe(401);
    expect(mocks.findRecipes).not.toHaveBeenCalled();
  });

  it.each([
    ["?context=other"],
    ["?context=similar"],
    ["?context=also-cooked&recipeId=not-a-cuid"],
    ["?context=today&limit=13"],
    ["?context=today&limit=0"],
    [`?context=today&pantryItemId=${pantryItemId}`],
    [`?context=today&userId=${userId}`],
  ])("rejects invalid parameters %s with 422", async (query) => {
    expect((await get(query)).status).toBe(422);
    expect(mocks.findRecipes).not.toHaveBeenCalled();
  });

  it("loads only the token owner's profile, pantry, history and today's meals; returns items with reasons", async () => {
    const response = await get("?context=for-you&limit=4");
    expect(response.status).toBe(200);
    expect(response.body.coldStart).toBe(true);
    expect(response.body.items).toHaveLength(4);
    for (const entry of response.body.items) {
      expect(Object.keys(entry).sort()).toEqual(["components", "reason", "recipe", "score"]);
      expect(entry.reason).toEqual(expect.any(String));
    }
    expect(mocks.findRecipes.mock.calls[0][0].where).toEqual({ hiddenAt: null });
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId } });
    expect(mocks.findPantry).toHaveBeenCalledWith({ where: { userId, quantity: { gt: 0 } } });
    expect(mocks.findMealItems.mock.calls[0][0].where.day.mealPlan).toEqual({ userId, status: "ACTIVE" });
    const userHistory = mocks.queryRaw.mock.calls.map(([query]) => query).find((query) => query.sql.includes("PLANNED"));
    expect(userHistory.values.every((value: unknown) => value === userId)).toBe(true);
  });

  it("never returns seafood to a seafood-allergic user", async () => {
    const response = await get("?context=today&limit=12");
    const seafood = /^(cá|tôm|nước mắm)/;
    for (const entry of response.body.items) {
      const recipe = recipes.find((r) => r.id === entry.recipe.id)!;
      expect(recipe.ingredients.some((ingredient) => seafood.test(ingredient.name.toLocaleLowerCase("vi"))), recipe.slug).toBe(false);
    }
  });

  it("returns 404 for a pantry item that does not belong to the user (no other user's data is used)", async () => {
    const response = await get(`?context=pantry&pantryItemId=${pantryItemId}`);
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy thực phẩm." } });
    expect(mocks.findPantryItem).toHaveBeenCalledWith({ where: { id: pantryItemId, userId } });
  });

  it("returns 404 for an unknown recipe in similar/also-cooked", async () => {
    mocks.findRecipe.mockResolvedValue(null);
    expect(await get(`?context=similar&recipeId=${recipeId}`)).toEqual({ status: 404, body: { message: "Không tìm thấy công thức." } });
  });

  it("suggests dishes for an owned expiring item", async () => {
    mocks.findPantryItem.mockResolvedValue({ id: pantryItemId, userId, name: "Đậu hũ", quantity: 300, unit: "G", expiryDate: new Date() });
    mocks.findPantry.mockResolvedValue([{ id: pantryItemId, userId, name: "Đậu hũ", quantity: 300, unit: "G", expiryDate: new Date() }]);
    const response = await get(`?context=pantry&pantryItemId=${pantryItemId}&limit=12`);
    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeGreaterThan(0);
    for (const entry of response.body.items) {
      expect(recipes.find((r) => r.id === entry.recipe.id)!.ingredients.some((ingredient) => ingredient.name === "Đậu hũ")).toBe(true);
    }
  });
});
