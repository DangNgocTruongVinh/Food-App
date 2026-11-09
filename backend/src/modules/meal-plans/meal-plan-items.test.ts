import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import mealPlanRoutes from "./meal-plans.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findPlan: vi.fn(), findRecipe: vi.fn(), findProfile: vi.fn(), findPantry: vi.fn(),
  createItem: vi.fn(), findItem: vi.fn(), deleteItem: vi.fn(),
  updateShopping: vi.fn(), deleteShopping: vi.fn(), createShopping: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
const client = () => ({
  mealPlan: { findFirst: mocks.findPlan },
  mealPlanItem: { create: mocks.createItem, findFirst: mocks.findItem, deleteMany: mocks.deleteItem },
  recipe: { findFirst: mocks.findRecipe },
  nutritionProfile: { findUnique: mocks.findProfile },
  pantryItem: { findMany: mocks.findPantry },
  shoppingItem: { updateMany: mocks.updateShopping, deleteMany: mocks.deleteShopping, create: mocks.createShopping },
});
const tx = fakeTransaction(client);
vi.mock("../../lib/prisma.js", () => ({ prisma: new Proxy({}, {
  get: (_target, key) => (key === "$transaction" ? mocks.transaction : Reflect.get(client(), key)),
}) }));

const app = testApp("/api/meal-plans", mealPlanRoutes);
const userId = "user-a";
const otherUserId = "user-b";
const planId = "cm12345678901234567890123";
const dayId = "cm22345678901234567890123";
const itemId = "cm32345678901234567890123";
const recipeId = "cm42345678901234567890123";
const token = (sub = userId) => `Bearer ${jwt.sign({ sub, email: "demo@nouri.vn" }, mocks.secret)}`;

const ingredient = { id: "cm52345678901234567890123", recipeId, name: "Đậu hũ", quantity: 400, unit: "G", optional: false };
const recipe = {
  id: recipeId, slug: "dau-hu", name: "Đậu hũ sốt cà", description: "Món chay", instructions: ["Nấu"],
  prepMinutes: 10, cookMinutes: 15, servings: 2, calories: 300, proteinG: 20, carbsG: 15, fatG: 10, fiberG: 5,
  cuisine: "Việt Nam", dietTags: ["VEGAN"], mealTypes: ["LUNCH"], hiddenAt: null, ingredients: [ingredient],
};
const added = { id: itemId, dayId, recipeId, mealType: "LUNCH", servings: 1, calories: 300, completed: false, recipe };
const plan = {
  id: planId, userId, name: "Thực đơn tuần", startDate: new Date("2026-11-08T00:00:00.000Z"), endDate: new Date("2026-11-14T00:00:00.000Z"),
  status: "DRAFT", calorieTarget: 2000, aiGenerated: false, summary: null,
  days: [{ id: dayId, mealPlanId: planId, date: new Date("2026-11-08T00:00:00.000Z"), note: null, items: [added] }], shoppingItems: [],
  createdAt: new Date("2026-11-07T00:00:00.000Z"), updatedAt: new Date("2026-11-07T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findPlan.mockResolvedValue(plan);
  mocks.findRecipe.mockResolvedValue(recipe);
  mocks.findProfile.mockResolvedValue({ dietType: "BALANCED", allergies: [], dislikedFoods: [] });
  mocks.findPantry.mockResolvedValue([]);
  mocks.createItem.mockResolvedValue(added);
  mocks.findItem.mockResolvedValue({ ...added, day: { mealPlanId: planId, mealPlan: { shoppingItems: [] } } });
  mocks.deleteItem.mockResolvedValue({ count: 1 });
  mocks.updateShopping.mockResolvedValue({ count: 1 });
  mocks.deleteShopping.mockResolvedValue({ count: 1 });
  mocks.createShopping.mockResolvedValue({});
  mocks.transaction.mockImplementation(tx.run);
});

afterEach(() => vi.restoreAllMocks());

describe("Manual meal plan items", () => {
  it("checks plan ownership and creates a meal item with the requested servings", async () => {
    const response = await request(app, `/api/meal-plans/${planId}/items`, {
      method: "POST", token: token(), body: { dayId, mealType: "LUNCH", recipeId, servings: 1 },
    });
    expect(response.status).toBe(201);
    expect(mocks.findPlan).toHaveBeenCalledWith(expect.objectContaining({ where: { id: planId, userId } }));
    expect(mocks.createItem).toHaveBeenCalledWith({ data: { dayId, recipeId, mealType: "LUNCH", servings: 1, calories: 300 } });
    expect(mocks.createShopping).toHaveBeenCalledWith({ data: { mealPlanId: planId, name: "Đậu hũ", quantity: 200, unit: "G", category: "Đậu & hạt" } });
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createItem)).toBe(true);
  });

  it("rejects an unowned plan and an unsafe recipe before writing", async () => {
    mocks.findPlan.mockResolvedValue(null);
    expect((await request(app, `/api/meal-plans/${planId}/items`, {
      method: "POST", token: token(otherUserId), body: { dayId, mealType: "LUNCH", recipeId, servings: 1 },
    })).status).toBe(404);
    expect(mocks.createItem).not.toHaveBeenCalled();

    mocks.findPlan.mockResolvedValue(plan);
    mocks.findRecipe.mockResolvedValue({ ...recipe, dietTags: ["BALANCED"], ingredients: [{ ...ingredient, name: "Tôm" }] });
    mocks.findProfile.mockResolvedValue({ dietType: "BALANCED", allergies: ["Hải sản"], dislikedFoods: [] });
    expect(await request(app, `/api/meal-plans/${planId}/items`, {
      method: "POST", token: token(), body: { dayId, mealType: "LUNCH", recipeId, servings: 1 },
    })).toEqual({ status: 422, body: { message: "Món này không phù hợp với dị ứng hoặc chế độ ăn trong hồ sơ." } });
    expect(mocks.createItem).not.toHaveBeenCalled();
  });

  it("validates the serving step and ownership when deleting a meal", async () => {
    expect((await request(app, `/api/meal-plans/${planId}/items`, {
      method: "POST", token: token(), body: { dayId, mealType: "LUNCH", recipeId, servings: 0.25 },
    })).status).toBe(422);
    expect(mocks.findPlan).not.toHaveBeenCalled();

    mocks.findItem.mockResolvedValue(null);
    expect((await request(app, `/api/meal-plans/items/${itemId}`, { method: "DELETE", token: token(otherUserId) })).status).toBe(404);
    expect(mocks.deleteItem).not.toHaveBeenCalled();
  });

  it("deletes an uneaten owned meal and removes its now-unneeded shopping line", async () => {
    const openLine = { id: "cm62345678901234567890123", mealPlanId: planId, name: "Đậu hũ", quantity: 200, unit: "G", purchased: false, category: "Đậu & hạt" };
    mocks.findItem.mockResolvedValue({ ...added, day: { mealPlanId: planId, mealPlan: { shoppingItems: [openLine] } } });
    expect((await request(app, `/api/meal-plans/items/${itemId}`, { method: "DELETE", token: token() })).status).toBe(200);
    expect(mocks.deleteItem).toHaveBeenCalledWith({ where: { id: itemId, completed: false, day: { mealPlan: { userId } } } });
    expect(mocks.deleteShopping).toHaveBeenCalledWith({ where: { id: openLine.id, purchased: false } });
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.deleteItem)).toBe(true);
  });

  // Bữa đã ăn: kho đã bị trừ và dòng đi chợ của nó đã mua/xóa; thêm hoặc xóa món khác không được làm nó quay lại.
  const shrimp = { ...recipe, id: "cm72345678901234567890123", name: "Tôm rang", ingredients: [{ ...ingredient, name: "Tôm", quantity: 300 }] };
  const eaten = { ...added, id: "cm82345678901234567890123", completed: true, recipeId: shrimp.id, recipe: shrimp };
  const planWithEaten = { ...plan, days: [{ ...plan.days[0], items: [eaten] }], shoppingItems: [] };
  const shoppingNames = () => mocks.createShopping.mock.calls.map(([arg]) => arg.data.name);

  it("adding a meal only adds that meal's share: an eaten meal never comes back to the shopping list", async () => {
    mocks.findPlan.mockResolvedValue(planWithEaten);
    expect((await request(app, `/api/meal-plans/${planId}/items`, {
      method: "POST", token: token(), body: { dayId, mealType: "LUNCH", recipeId, servings: 1 },
    })).status).toBe(201);
    expect(shoppingNames()).toEqual(["Đậu hũ"]);
    expect(mocks.updateShopping).not.toHaveBeenCalled();
  });

  it("deleting a meal only removes its own share and never recreates lines of eaten meals", async () => {
    mocks.findPlan.mockResolvedValue(planWithEaten);
    const tofuLine = { id: "cm62345678901234567890123", mealPlanId: planId, name: "Đậu hũ", quantity: 500, unit: "G", purchased: false, category: "Đậu & hạt" };
    mocks.findItem.mockResolvedValue({ ...added, day: { mealPlanId: planId, mealPlan: { shoppingItems: [tofuLine] } } });
    expect((await request(app, `/api/meal-plans/items/${itemId}`, { method: "DELETE", token: token() })).status).toBe(200);
    expect(mocks.updateShopping).toHaveBeenCalledWith({ where: { id: tofuLine.id, purchased: false }, data: { quantity: 300 } });
    expect(mocks.createShopping).not.toHaveBeenCalled();
    expect(mocks.findPantry).not.toHaveBeenCalled();
  });

  it("adds a snack to an empty day (no meal yet) when the recipe fits every meal", async () => {
    mocks.findPlan.mockResolvedValue({ ...plan, days: [{ ...plan.days[0], items: [] }] });
    mocks.findRecipe.mockResolvedValue({ ...recipe, mealTypes: [] });
    expect((await request(app, `/api/meal-plans/${planId}/items`, {
      method: "POST", token: token(), body: { dayId, mealType: "SNACK", recipeId, servings: 0.5 },
    })).status).toBe(201);
    expect(mocks.createItem).toHaveBeenCalledWith({ data: { dayId, recipeId, mealType: "SNACK", servings: 0.5, calories: 150 } });
  });
});
