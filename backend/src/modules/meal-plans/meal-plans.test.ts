import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import { seedRecipes } from "../../../prisma/seed-data.js";
import mealPlanRoutes from "./meal-plans.routes.js";
import { filterRecipesForProfile } from "../../services/dietary.service.js";
import { fallbackPlan } from "./meal-plans.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  listPlans: vi.fn(),
  findPlan: vi.fn(),
  updatePlans: vi.fn(),
  findUniquePlan: vi.fn(),
  deletePlans: vi.fn(),
  updateMealItems: vi.fn(),
  findMealItem: vi.fn(),
  updateShoppingItems: vi.fn(),
  findShoppingItem: vi.fn(),
  findUser: vi.fn(),
  listPantry: vi.fn(),
  listRecipes: vi.fn(),
  createPlan: vi.fn(),
  transaction: vi.fn(),
  generatePlanWithAI: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../ai/ai.service.js", () => ({
  generatePlanWithAI: mocks.generatePlanWithAI,
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    mealPlan: {
      findMany: mocks.listPlans,
      findFirst: mocks.findPlan,
      updateMany: mocks.updatePlans,
      findUnique: mocks.findUniquePlan,
      deleteMany: mocks.deletePlans,
      create: mocks.createPlan,
    },
    mealPlanItem: { updateMany: mocks.updateMealItems, findUnique: mocks.findMealItem },
    shoppingItem: { updateMany: mocks.updateShoppingItems, findUnique: mocks.findShoppingItem },
    user: { findUnique: mocks.findUser },
    pantryItem: { findMany: mocks.listPantry },
    recipe: { findMany: mocks.listRecipes },
    $transaction: mocks.transaction,
  },
}));

const app = testApp("/api/meal-plans", mealPlanRoutes);
const userId = "user-a";
const otherUserId = "user-b";
const planId = "cm12345678901234567890123";
const mealItemId = "cm22345678901234567890123";
const shoppingItemId = "cm32345678901234567890123";
const token = (sub = userId) => `Bearer ${jwt.sign({ sub, email: "demo@nouri.vn" }, mocks.secret)}`;
const ingredient = { id: "ingredient-a", recipeId: "recipe-a", name: "Ức gà", quantity: 100, unit: "G", optional: false };
const recipe = {
  id: "recipe-a", slug: "uc-ga", name: "Ức gà", description: "Món giàu protein", instructions: ["Áp chảo"],
  prepMinutes: 10, cookMinutes: 20, servings: 1, calories: 400, proteinG: 35, carbsG: 25,
  fatG: 12, fiberG: 5, cuisine: "Việt Nam", dietTags: ["BALANCED"], ingredients: [ingredient],
  createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
};
const mealItem = {
  id: mealItemId, dayId: "day-a", recipeId: recipe.id, mealType: "BREAKFAST",
  servings: 1, completed: true, calories: 400, recipe,
};
const shoppingItem = {
  id: shoppingItemId, mealPlanId: planId, name: "Ức gà", quantity: 2050,
  unit: "G", purchased: true, category: null,
};
const plan = {
  id: planId, userId, name: "Thực đơn 01/10/2026",
  startDate: new Date("2026-10-01T00:00:00.000Z"), endDate: new Date("2026-10-07T00:00:00.000Z"),
  status: "DRAFT", calorieTarget: 2000, aiGenerated: false, summary: "Thực đơn mẫu",
  days: [{ id: "day-a", mealPlanId: planId, date: new Date("2026-10-01T00:00:00.000Z"), note: null, items: [mealItem] }],
  shoppingItems: [shoppingItem],
  createdAt: new Date("2026-09-15T00:00:00.000Z"), updatedAt: new Date("2026-09-15T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.OPENAI_API_KEY;
  mocks.listPlans.mockResolvedValue([plan]);
  mocks.findPlan.mockResolvedValue(plan);
  mocks.updatePlans.mockResolvedValue({ count: 1 });
  mocks.findUniquePlan.mockResolvedValue({ ...plan, status: "ACTIVE" });
  mocks.deletePlans.mockResolvedValue({ count: 1 });
  mocks.updateMealItems.mockResolvedValue({ count: 1 });
  mocks.findMealItem.mockResolvedValue(mealItem);
  mocks.updateShoppingItems.mockResolvedValue({ count: 1 });
  mocks.findShoppingItem.mockResolvedValue(shoppingItem);
  mocks.findUser.mockResolvedValue({
    id: userId,
    profile: {
      age: 30, gender: "OTHER", heightCm: 170, weightKg: 65, targetWeightKg: 65,
      activityLevel: "MODERATE", goal: "MAINTAIN", dietType: "BALANCED",
      allergies: [], dislikedFoods: [], preferredCuisines: ["Việt Nam"], mealsPerDay: 3,
      dailyCalorieTarget: 2000,
    },
  });
  mocks.listPantry.mockResolvedValue([{ name: "Ức gà", quantity: 50, unit: "G", expiryDate: null }]);
  mocks.listRecipes.mockResolvedValue([recipe]);
  mocks.generatePlanWithAI.mockResolvedValue(null);
  mocks.createPlan.mockResolvedValue(plan);
  mocks.transaction.mockImplementation((operation) => operation({
    mealPlan: { updateMany: mocks.updatePlans, findUnique: mocks.findUniquePlan },
    mealPlanItem: { updateMany: mocks.updateMealItems, findUnique: mocks.findMealItem },
    shoppingItem: { updateMany: mocks.updateShoppingItems, findUnique: mocks.findShoppingItem },
  }));
});

afterEach(() => vi.restoreAllMocks());

describe("Meal Plan and Shopping HTTP contract (no database)", () => {
  it("lists only the authenticated user's plans with the existing include and order", async () => {
    const response = await request(app, "/api/meal-plans?userId=user-b", { token: token() });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify([plan])) });
    expect(mocks.listPlans).toHaveBeenCalledWith({
      where: { userId },
      include: {
        days: { orderBy: { date: "asc" }, include: { items: { include: { recipe: { include: { ingredients: true } } } } } },
        shoppingItems: { orderBy: [{ purchased: "asc" }, { name: "asc" }] },
      },
      orderBy: { startDate: "desc" },
    });
  });

  it("gets a plan only when it belongs to the authenticated user", async () => {
    const response = await request(app, `/api/meal-plans/${planId}`, { token: token() });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify(plan)) });
    expect(mocks.findPlan).toHaveBeenCalledWith(expect.objectContaining({ where: { id: planId, userId } }));
  });

  it("returns 404 for a missing or unowned plan detail", async () => {
    mocks.findPlan.mockResolvedValue(null);
    expect(await request(app, `/api/meal-plans/${planId}`, { token: token(otherUserId) })).toEqual({
      status: 404, body: { message: "Không tìm thấy thực đơn." },
    });
  });

  it("generates the same seven-day fallback plan and shopping shortage", async () => {
    const response = await request(app, "/api/meal-plans/generate", {
      method: "POST", token: token(), body: { startDate: "2026-10-01" },
    });
    expect(response).toEqual({ status: 201, body: JSON.parse(JSON.stringify(plan)) });
    expect(mocks.generatePlanWithAI).toHaveBeenCalledWith(expect.objectContaining({
      mealsPerDay: 3,
      dietType: "BALANCED",
      pantry: [{ name: "Ức gà", quantity: 50, unit: "G", expiryDate: null }],
      recipes: [expect.objectContaining({ id: recipe.id, name: recipe.name })],
    }));
    const data = mocks.createPlan.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId,
      name: "Thực đơn 1/10/2026",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-07T00:00:00.000Z"),
      calorieTarget: 2000,
      aiGenerated: false,
      shoppingItems: { create: [{ name: "Ức gà", quantity: 2050, unit: "G" }] },
    });
    expect(data.days.create).toHaveLength(7);
    expect(data.days.create.every((day: { items: { create: unknown[] } }) => day.items.create.length === 3)).toBe(true);
  });

  it("corrects an OpenAI plan with a wrong-meal dish and an allergen before saving", async () => {
    const seedAsDb = seedRecipes.map((item) => ({
      ...item, id: item.slug, servings: 1, createdAt: new Date(0), updatedAt: new Date(0),
      ingredients: item.ingredients.map((ingredient, index) => ({ id: `${item.slug}-${index}`, recipeId: item.slug, optional: false, ...ingredient })),
    }));
    mocks.findUser.mockResolvedValue({
      id: userId,
      profile: { dietType: "BALANCED", allergies: ["Hải sản"], dislikedFoods: [], preferredCuisines: [], mealsPerDay: 3, dailyCalorieTarget: 2000 },
    });
    mocks.listRecipes.mockResolvedValue(seedAsDb);
    mocks.listPantry.mockResolvedValue([]);
    // OpenAI (mock) đề xuất món chè vào bữa trưa và món cá cho người dị ứng hải sản.
    const aiPlan = { ...fallbackPlan(filterRecipesForProfile(seedAsDb, { allergies: ["Hải sản"] }), new Set(), 3), summary: "AI" };
    aiPlan.days[0].meals[1] = { ...aiPlan.days[0].meals[1], recipeId: "che-dau-den" };
    aiPlan.days[1].meals[2] = { ...aiPlan.days[1].meals[2], recipeId: "ca-kho-to" };
    mocks.generatePlanWithAI.mockResolvedValue(aiPlan);

    const response = await request(app, "/api/meal-plans/generate", { method: "POST", token: token(), body: { startDate: "2026-10-01" } });
    expect(response.status).toBe(201);
    const sentRecipeIds = mocks.generatePlanWithAI.mock.calls[0][0].recipes.map((item: { id: string }) => item.id);
    expect(sentRecipeIds).not.toContain("ca-kho-to");
    const data = mocks.createPlan.mock.calls[0][0].data;
    expect(data.aiGenerated).toBe(true);
    const saved = data.days.create.map((day: { items: { create: Array<{ recipeId: string; mealType: string }> } }) => day.items.create);
    expect(saved[0][1]).toMatchObject({ mealType: "LUNCH" });
    expect(saved[0][1].recipeId).not.toBe("che-dau-den");
    expect(saved[1][2]).toMatchObject({ mealType: "DINNER" });
    expect(saved[1][2].recipeId).not.toBe("ca-kho-to");
    for (const items of saved) {
      for (const item of items) {
        const recipe = seedAsDb.find((candidate) => candidate.id === item.recipeId)!;
        expect(recipe.mealTypes).toContain(item.mealType);
        expect(recipe.ingredients.map((ingredient) => ingredient.name)).not.toContain("Nước mắm");
      }
    }
  });

  it("updates plan status by id and owner in one transaction", async () => {
    const response = await request(app, `/api/meal-plans/${planId}/status`, {
      method: "PATCH", token: token(), body: { status: "ACTIVE", userId: otherUserId },
    });
    expect(response.status).toBe(200);
    expect(mocks.updatePlans).toHaveBeenCalledWith({ where: { id: planId, userId }, data: { status: "ACTIVE" } });
    expect(mocks.findUniquePlan).toHaveBeenCalledWith(expect.objectContaining({ where: { id: planId } }));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a status update for an unowned plan", async () => {
    mocks.updatePlans.mockResolvedValue({ count: 0 });
    expect(await request(app, `/api/meal-plans/${planId}/status`, {
      method: "PATCH", token: token(otherUserId), body: { status: "ACTIVE" },
    })).toEqual({ status: 404, body: { message: "Không tìm thấy thực đơn." } });
    expect(mocks.findUniquePlan).not.toHaveBeenCalled();
  });

  it("updates meal completion by item id and nested plan owner", async () => {
    const response = await request(app, `/api/meal-plans/items/${mealItemId}`, {
      method: "PATCH", token: token(), body: { completed: true },
    });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify(mealItem)) });
    expect(mocks.updateMealItems).toHaveBeenCalledWith({
      where: { id: mealItemId, day: { mealPlan: { userId } } }, data: { completed: true },
    });
  });

  it("rejects a meal update for an unowned item", async () => {
    mocks.updateMealItems.mockResolvedValue({ count: 0 });
    expect(await request(app, `/api/meal-plans/items/${mealItemId}`, {
      method: "PATCH", token: token(otherUserId), body: { completed: true },
    })).toEqual({ status: 404, body: { message: "Không tìm thấy bữa ăn." } });
    expect(mocks.findMealItem).not.toHaveBeenCalled();
  });

  it("updates Shopping purchase state by item id and plan owner", async () => {
    const response = await request(app, `/api/meal-plans/shopping/${shoppingItemId}`, {
      method: "PATCH", token: token(), body: { purchased: true },
    });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify(shoppingItem)) });
    expect(mocks.updateShoppingItems).toHaveBeenCalledWith({
      where: { id: shoppingItemId, mealPlan: { userId } }, data: { purchased: true },
    });
  });

  it("rejects a Shopping update for an unowned item", async () => {
    mocks.updateShoppingItems.mockResolvedValue({ count: 0 });
    expect(await request(app, `/api/meal-plans/shopping/${shoppingItemId}`, {
      method: "PATCH", token: token(otherUserId), body: { purchased: true },
    })).toEqual({ status: 404, body: { message: "Không tìm thấy nguyên liệu mua sắm." } });
    expect(mocks.findShoppingItem).not.toHaveBeenCalled();
  });

  it("deletes only a plan owned by the authenticated user", async () => {
    expect(await request(app, `/api/meal-plans/${planId}`, { method: "DELETE", token: token() }))
      .toEqual({ status: 204, body: null });
    expect(mocks.deletePlans).toHaveBeenCalledWith({ where: { id: planId, userId } });
  });

  it("returns 404 instead of deleting an unowned plan", async () => {
    mocks.deletePlans.mockResolvedValue({ count: 0 });
    expect(await request(app, `/api/meal-plans/${planId}`, { method: "DELETE", token: token(otherUserId) }))
      .toEqual({ status: 404, body: { message: "Không tìm thấy thực đơn." } });
  });

  it.each([
    ["GET", "/api/meal-plans", undefined],
    ["GET", `/api/meal-plans/${planId}`, undefined],
    ["POST", "/api/meal-plans/generate", { startDate: "2026-10-01" }],
    ["PATCH", `/api/meal-plans/${planId}/status`, { status: "ACTIVE" }],
    ["PATCH", `/api/meal-plans/items/${mealItemId}`, { completed: true }],
    ["PATCH", `/api/meal-plans/shopping/${shoppingItemId}`, { purchased: true }],
    ["DELETE", `/api/meal-plans/${planId}`, undefined],
  ])("requires authentication for %s %s", async (method, path, body) => {
    expect(await request(app, path, { method, body })).toEqual({
      status: 401, body: { message: "Bạn cần đăng nhập để tiếp tục." },
    });
  });

  it("uses the shared 500 response when listing fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listPlans.mockRejectedValue(new Error("database unavailable"));
    expect(await request(app, "/api/meal-plans", { token: token() })).toEqual({
      status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." },
    });
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("Meal Plan and Shopping validation", () => {
  it.each(["", "01-10-2026", "2026-02-30"])("rejects invalid generation date %j", async (startDate) => {
    const response = await request(app, "/api/meal-plans/generate", {
      method: "POST", token: token(), body: { startDate },
    });
    expect(response.status).toBe(422);
    expect(mocks.findUser).not.toHaveBeenCalled();
  });

  it.each([
    [`/api/meal-plans/${planId}/status`, { status: "ARCHIVED" }],
    [`/api/meal-plans/items/${mealItemId}`, { completed: "yes" }],
    [`/api/meal-plans/shopping/${shoppingItemId}`, { purchased: 1 }],
  ])("rejects invalid patch body for %s", async (path, body) => {
    const response = await request(app, path, { method: "PATCH", token: token(), body });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/meal-plans/not-a-cuid", undefined],
    ["PATCH", "/api/meal-plans/not-a-cuid/status", { status: "ACTIVE" }],
    ["PATCH", "/api/meal-plans/items/not-a-cuid", { completed: true }],
    ["PATCH", "/api/meal-plans/shopping/not-a-cuid", { purchased: true }],
    ["DELETE", "/api/meal-plans/not-a-cuid", undefined],
  ])("rejects invalid id for %s %s", async (method, path, body) => {
    const response = await request(app, path, { method, token: token(), body });
    expect(response.status).toBe(422);
  });
});
