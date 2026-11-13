import type { DietType, MealType } from "@prisma/client";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import { pickFeaturedRecipes } from "./featured-recipes.js";
import recipeRoutes from "./recipes.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findProfile: vi.fn(),
  findPantry: vi.fn(),
  count: vi.fn(),
  findFavorites: vi.fn(),
  findFavorite: vi.fn(),
  createFavorites: vi.fn(),
  deleteFavorites: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    recipe: { findMany: mocks.findMany, findUnique: mocks.findUnique, count: mocks.count },
    nutritionProfile: { findUnique: mocks.findProfile },
    pantryItem: { findMany: mocks.findPantry },
    favoriteRecipe: {
      findMany: mocks.findFavorites, findUnique: mocks.findFavorite, createMany: mocks.createFavorites, deleteMany: mocks.deleteFavorites,
    },
  },
}));

const app = testApp("/api/recipes", recipeRoutes);
const userId = "user-a";
const recipeId = "cm12345678901234567890123";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "demo@nouri.vn" }, mocks.secret)}`;
const recipe = {
  id: recipeId,
  slug: "uc-ga-rau-cu",
  name: "Ức gà rau củ",
  description: "Bữa ăn cân bằng.",
  instructions: ["Áp chảo thịt gà", "Thêm rau củ"],
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 2,
  calories: 420,
  proteinG: 38,
  carbsG: 32,
  fatG: 14,
  fiberG: 7,
  cuisine: "Việt Nam",
  dietTags: ["BALANCED", "HIGH_PROTEIN"],
  ingredients: [{
    id: "ingredient-a", recipeId, name: "Ức gà", quantity: 300, unit: "G", optional: false,
  }],
  hiddenAt: null,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([recipe]);
  mocks.findUnique.mockResolvedValue(recipe);
  mocks.findProfile.mockResolvedValue(null);
  mocks.findPantry.mockResolvedValue([]);
  mocks.findFavorites.mockResolvedValue([]);
  mocks.findFavorite.mockResolvedValue(null);
  mocks.createFavorites.mockResolvedValue({ count: 1 });
  mocks.deleteFavorites.mockResolvedValue({ count: 1 });
});

afterEach(() => vi.restoreAllMocks());

describe("Recipes HTTP contract (no database)", () => {
  it("lists recipes with ingredients using the existing name order, each with the user's fit", async () => {
    const response = await request(app, "/api/recipes", { token: token() });
    const fit = { allergens: [], dislikedFoods: [], dietConflict: null, safe: true };
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify([{ ...recipe, fit, favorite: false }])) });
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId } });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { hiddenAt: null, deletedAt: null }, include: { ingredients: true }, orderBy: { name: "asc" },
    });
  });

  it("cuisine lọc bằng Prisma; từ khóa lọc bằng searchRecipes (không dấu, đủ từ, cả nguyên liệu)", async () => {
    const response = await request(
      app,
      `/api/recipes?search=${encodeURIComponent("uc ga")}&cuisine=${encodeURIComponent("Việt Nam")}`,
      { token: token() },
    );
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { hiddenAt: null, deletedAt: null, cuisine: "Việt Nam" },
      include: { ingredients: true },
      orderBy: { name: "asc" },
    });
    mocks.findMany.mockResolvedValueOnce([{ ...recipe, name: "Cháo gừng", ingredients: [{ ...recipe.ingredients[0], name: "Ức gà" }] }, { ...recipe, name: "Phở", ingredients: [] }]);
    const searched = await request(app, `/api/recipes?search=${encodeURIComponent("uc ga")}`, { token: token() });
    expect(searched.body.map((item: { name: string }) => item.name)).toEqual(["Cháo gừng"]);
  });

  it("preserves empty search and cuisine parameters as no filters", async () => {
    await request(app, "/api/recipes?search=&cuisine=", { token: token() });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { hiddenAt: null, deletedAt: null }, include: { ingredients: true }, orderBy: { name: "asc" },
    });
  });

  it("gets one recipe with its ingredients", async () => {
    const response = await request(app, `/api/recipes/${recipeId}`, { token: token() });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify({ ...recipe, hidden: false, deleted: false, favorite: false })) });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: recipeId }, include: { ingredients: true },
    });
  });

  it("returns the existing 404 response when a recipe does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await request(app, `/api/recipes/${recipeId}`, { token: token() })).toEqual({
      status: 404, body: { message: "Không tìm thấy công thức." },
    });
  });

  it.each([
    ["/api/recipes", "list"],
    [`/api/recipes/${recipeId}`, "detail"],
  ])("requires authentication for %s", async (path, operation) => {
    expect(await request(app, path)).toEqual({
      status: 401, body: { message: "Bạn cần đăng nhập để tiếp tục." },
    });
    expect(operation === "list" ? mocks.findMany : mocks.findUnique).not.toHaveBeenCalled();
  });

  it("uses the shared error response when Prisma list fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findMany.mockRejectedValue(new Error("database unavailable"));
    expect(await request(app, "/api/recipes", { token: token() })).toEqual({
      status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." },
    });
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("Recipe \"Dành cho bạn\" for the signed-in user", () => {
  const forYouPath = `/api/recipes/${recipeId}/for-you`;
  const seafoodRecipe = {
    ...recipe,
    calories: 500,
    dietTags: ["BALANCED"],
    ingredients: [
      { id: "i1", recipeId, name: "Cá basa", quantity: 200, unit: "G", optional: false },
      { id: "i2", recipeId, name: "Trứng", quantity: 100, unit: "G", optional: false },
      { id: "i3", recipeId, name: "Hành lá", quantity: 10, unit: "G", optional: true },
    ],
  };
  const future = new Date(Date.now() + 30 * 86_400_000);

  it("returns pantry match, calorie share and warnings from the JWT user's own data", async () => {
    mocks.findUnique.mockResolvedValue(seafoodRecipe);
    mocks.findProfile.mockResolvedValue({ userId, dietType: "VEGETARIAN", allergies: ["Hải sản"], dislikedFoods: [], dailyCalorieTarget: 2000 });
    mocks.findPantry.mockResolvedValue([
      { name: "cá  BASA", quantity: 1, unit: "G", expiryDate: future },
      { name: "Trứng", quantity: 6, unit: "ITEM", expiryDate: null },
    ]);
    const response = await request(app, `${forYouPath}?userId=user-b`, { token: token() });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      recipeId,
      pantry: {
        totalIngredients: 3,
        inPantryCount: 2,
        inPantry: ["Cá basa", "Trứng"],
        missing: [{ name: "Hành lá", optional: true }],
        expiring: [],
        expired: [],
        unitMismatches: [{ name: "Trứng", recipeUnit: "G", pantryUnits: ["ITEM"] }],
      },
      calories: { recipeCalories: 500, dailyTarget: 2000, percentOfDailyTarget: 25 },
      warnings: { allergens: ["Cá (Cá basa)"], dislikedFoods: [], dietConflict: "VEGETARIAN" },
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: recipeId }, include: { ingredients: true } });
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId } });
    expect(mocks.findPantry).toHaveBeenCalledWith({ where: { userId, quantity: { gt: 0 } } });
  });

  it("works without a nutrition profile or pantry", async () => {
    const response = await request(app, forYouPath, { token: token() });
    expect(response.status).toBe(200);
    expect(response.body.pantry).toMatchObject({ totalIngredients: 1, inPantryCount: 0, missing: [{ name: "Ức gà", optional: false }] });
    expect(response.body.warnings).toEqual({ allergens: [], dislikedFoods: [], dietConflict: null });
    expect(response.body.calories.dailyTarget).toBeGreaterThan(0);
  });

  it("returns 404 for an unknown recipe", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await request(app, forYouPath, { token: token() })).toEqual({ status: 404, body: { message: "Không tìm thấy công thức." } });
  });

  it("requires authentication and a valid recipe id", async () => {
    expect((await request(app, forYouPath)).status).toBe(401);
    expect((await request(app, "/api/recipes/not-a-cuid/for-you", { token: token() })).status).toBe(422);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.findPantry).not.toHaveBeenCalled();
  });
});

describe("Public recipe stats for the Landing page", () => {
  it("returns only counts per real group without authentication", async () => {
    mocks.count
      .mockResolvedValueOnce(33).mockResolvedValueOnce(9).mockResolvedValueOnce(17)
      .mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(12);
    const response = await request(app, "/api/recipes/stats");
    expect(response).toEqual({
      status: 200, body: { total: 33, breakfast: 9, vegetarian: 17, vegan: 10, lowCarb: 4, highProtein: 12 },
    });
    expect(mocks.count.mock.calls.map((call) => call[0])).toEqual([
      { where: { hiddenAt: null, deletedAt: null } },
      { where: { hiddenAt: null, deletedAt: null, mealTypes: { has: "BREAKFAST" } } },
      { where: { hiddenAt: null, deletedAt: null, dietTags: { hasSome: ["VEGETARIAN", "VEGAN"] } } },
      { where: { hiddenAt: null, deletedAt: null, dietTags: { has: "VEGAN" } } },
      { where: { hiddenAt: null, deletedAt: null, dietTags: { has: "LOW_CARB" } } },
      { where: { hiddenAt: null, deletedAt: null, dietTags: { has: "HIGH_PROTEIN" } } },
    ]);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("keeps the other recipe endpoints behind authentication", async () => {
    expect((await request(app, "/api/recipes")).status).toBe(401);
    expect((await request(app, `/api/recipes/${recipeId}`)).status).toBe(401);
    expect((await request(app, `/api/recipes/${recipeId}/for-you`)).status).toBe(401);
  });

  it("uses the shared error response when counting fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.count.mockRejectedValue(new Error("database unavailable"));
    expect(await request(app, "/api/recipes/stats")).toEqual({
      status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." },
    });
  });
});

describe("Public featured recipes for the Landing page", () => {
  const SUMMARY_KEYS = ["calories", "cookMinutes", "dietTags", "id", "imageUrl", "mealTypes", "name", "prepMinutes", "slug"];
  const row = (name: string, mealTypes: MealType[], imagePublicId: string | null = null) => ({
    id: `id-${name}`, slug: name.toLowerCase(), name, imageUrl: imagePublicId ? `https://res.cloudinary.com/x/${imagePublicId}.jpg` : "/assets/recipe-bowl.jpg",
    imagePublicId, calories: 400, prepMinutes: 10, cookMinutes: 20, dietTags: ["BALANCED"] as DietType[], mealTypes,
  });

  it("works without authentication and selects only visible recipes and summary fields", async () => {
    mocks.findMany.mockResolvedValue([row("Phở bò", ["BREAKFAST", "LUNCH"])]);
    const response = await request(app, "/api/recipes/featured");
    expect(response.status).toBe(200);
    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ hiddenAt: null, deletedAt: null });
    expect(query.include).toBeUndefined();
    expect(Object.keys(query.select).sort()).toEqual([...SUMMARY_KEYS, "imagePublicId"].sort());
    expect(Object.keys(response.body[0]).sort()).toEqual(SUMMARY_KEYS);
  });

  it("never reads or returns user data, even when a token is sent", async () => {
    mocks.findMany.mockResolvedValue([row("Phở bò", ["LUNCH"])]);
    const response = await request(app, "/api/recipes/featured", { token: token() });
    expect(response.status).toBe(200);
    expect(mocks.findProfile).not.toHaveBeenCalled();
    expect(mocks.findPantry).not.toHaveBeenCalled();
    expect(JSON.stringify(response.body)).not.toMatch(/userId|email|ingredients|instructions|imagePublicId/);
  });

  it("defaults to 6, accepts up to 12 and rejects other limits before calling Prisma", async () => {
    mocks.findMany.mockResolvedValue(Array.from({ length: 20 }, (_, index) => row(`Món ${String(index).padStart(2, "0")}`, ["LUNCH"])));
    expect((await request(app, "/api/recipes/featured")).body).toHaveLength(6);
    expect((await request(app, "/api/recipes/featured?limit=12")).body).toHaveLength(12);
    mocks.findMany.mockClear();
    for (const limit of ["0", "13", "abc", "2.5"]) {
      expect((await request(app, `/api/recipes/featured?limit=${limit}`)).status).toBe(422);
    }
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("puts recipes with an uploaded photo first, then mixes meals so a short list is not one kind of dish", () => {
    const picked = pickFeaturedRecipes([
      row("Bánh mì ốp la", ["BREAKFAST"]), row("Bún chả", ["LUNCH"]), row("Bánh mì đậu hũ", ["BREAKFAST"]),
      row("Cá kho tộ", ["LUNCH", "DINNER"], "nouri/recipes/ca"), row("Chè đậu đen", ["SNACK"]), row("Gà xào sả", ["DINNER"]),
    ], 5);
    expect(picked.map((recipe) => recipe.name)).toEqual(["Cá kho tộ", "Bánh mì đậu hũ", "Bún chả", "Gà xào sả", "Chè đậu đen"]);
    expect(picked.every((recipe) => !("imagePublicId" in recipe))).toBe(true);
  });
});

describe("Hidden (discontinued) recipes", () => {
  const hiddenRecipe = { ...recipe, hiddenAt: new Date("2026-10-31T00:00:00.000Z") };

  it("still opens the detail page by direct link, flagged as hidden", async () => {
    mocks.findUnique.mockResolvedValue(hiddenRecipe);
    const response = await request(app, `/api/recipes/${recipeId}`, { token: token() });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: recipeId, hidden: true });
  });

  it("returns 404 for \"Dành cho bạn\" of a hidden recipe", async () => {
    mocks.findUnique.mockResolvedValue(hiddenRecipe);
    expect(await request(app, `/api/recipes/${recipeId}/for-you`, { token: token() }))
      .toEqual({ status: 404, body: { message: "Món này đã ngừng sử dụng." } });
  });

  it("excludes hidden recipes from the list and from every public count", async () => {
    await request(app, "/api/recipes", { token: token() });
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ hiddenAt: null, deletedAt: null });
    mocks.count.mockResolvedValue(0);
    await request(app, "/api/recipes/stats");
    expect(mocks.count.mock.calls.every((call) => call[0].where.hiddenAt === null)).toBe(true);
    expect(mocks.count).toHaveBeenCalledTimes(6);
  });
});

describe("Recipes validation", () => {
  it.each([
    `/api/recipes?search=${"a".repeat(81)}`,
    `/api/recipes?cuisine=${"a".repeat(51)}`,
    "/api/recipes?search=a&search=b",
  ])("rejects invalid list query parameters: %s", async (path) => {
    const response = await request(app, path, { token: token() });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid recipe id before calling Prisma", async () => {
    const response = await request(app, "/api/recipes/not-a-cuid", { token: token() });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});

describe("UC24 Yêu thích công thức", () => {
  const recipeId = recipe.id;
  const path = `/api/recipes/${recipeId}/favorite`;

  it("bật yêu thích: ghi cho đúng người trong JWT, gọi lại không tạo trùng (skipDuplicates)", async () => {
    const response = await request(app, path, { method: "PUT", token: token() });
    expect(response).toEqual({ status: 200, body: { recipeId, favorite: true } });
    expect(mocks.createFavorites).toHaveBeenCalledWith({ data: [{ userId, recipeId }], skipDuplicates: true });
  });

  it("tắt yêu thích: chỉ xóa của chính người dùng", async () => {
    const response = await request(app, path, { method: "DELETE", token: token() });
    expect(response.body).toEqual({ recipeId, favorite: false });
    expect(mocks.deleteFavorites).toHaveBeenCalledWith({ where: { userId, recipeId } });
  });

  it("món không có → 404, món đã ngừng sử dụng → 422; không ghi gì", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    expect((await request(app, path, { method: "PUT", token: token() })).status).toBe(404);
    mocks.findUnique.mockResolvedValueOnce({ ...recipe, hiddenAt: new Date() });
    expect((await request(app, path, { method: "PUT", token: token() })).status).toBe(422);
    expect(mocks.createFavorites).not.toHaveBeenCalled();
  });

  it("danh sách yêu thích: chỉ của người trong JWT, bỏ món đã ngừng sử dụng, mới thêm trước; danh sách món gắn cờ favorite", async () => {
    mocks.findFavorites.mockImplementation(async (args: { select: Record<string, unknown> }) => (
      "recipe" in args.select ? [{ recipe }] : [{ recipeId }]
    ));
    const favorites = await request(app, "/api/recipes/favorites", { token: token() });
    expect(favorites.status).toBe(200);
    expect(favorites.body).toEqual([expect.objectContaining({ id: recipeId, favorite: true, fit: expect.any(Object) })]);
    expect(mocks.findFavorites).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, recipe: { hiddenAt: null, deletedAt: null } }, orderBy: { createdAt: "desc" },
    }));
    const list = await request(app, "/api/recipes", { token: token() });
    expect(list.body[0].favorite).toBe(true);
  });

  it("cần đăng nhập", async () => {
    expect((await request(app, "/api/recipes/favorites")).status).toBe(401);
    expect((await request(app, path, { method: "PUT" })).status).toBe(401);
  });
});
