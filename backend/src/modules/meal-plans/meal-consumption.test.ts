import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import mealPlanRoutes from "./meal-plans.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findFirstMealItem: vi.fn(), updateMealItems: vi.fn(), findMealItem: vi.fn(),
  listPantry: vi.fn(), updatePantry: vi.fn(), findFirstPantry: vi.fn(),
  createHistory: vi.fn(), listHistory: vi.fn(), updateHistory: vi.fn(), countHistory: vi.fn(),
  transaction: vi.fn(), syncNotifications: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../notifications/notifications.service.js", () => ({ syncPantryNotifications: mocks.syncNotifications }));
const client = () => ({
  mealPlanItem: { findFirst: mocks.findFirstMealItem, updateMany: mocks.updateMealItems, findUnique: mocks.findMealItem },
  pantryItem: { findMany: mocks.listPantry, updateMany: mocks.updatePantry, findFirst: mocks.findFirstPantry },
  pantryTransaction: { create: mocks.createHistory, findMany: mocks.listHistory, updateMany: mocks.updateHistory, count: mocks.countHistory },
});
const tx = fakeTransaction(client);
vi.mock("../../lib/prisma.js", () => ({ prisma: new Proxy({}, {
  get: (_target, key) => (key === "$transaction" ? mocks.transaction : Reflect.get(client(), key)),
}) }));

const app = testApp("/api/meal-plans", mealPlanRoutes);
const userId = "user-a";
const otherUserId = "user-b";
const mealItemId = "cm22345678901234567890123";
const tofuId = "cm41111111111111111111111";
const chiliId = "cm42222222222222222222222";
const oilId = "cm43333333333333333333333";
const token = (sub = userId) => `Bearer ${jwt.sign({ sub, email: `${sub}@nouri.vn` }, mocks.secret)}`;
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
// Món 2 khẩu phần, bữa ăn 1 khẩu phần → cần một nửa định lượng.
const recipe = {
  id: "recipe-a", name: "Đậu hũ sốt cà", servings: 2,
  ingredients: [
    { id: tofuId, recipeId: "recipe-a", name: "Đậu hũ", quantity: 400, unit: "G", optional: false },
    { id: chiliId, recipeId: "recipe-a", name: "Ớt", quantity: 10, unit: "G", optional: true },
    { id: oilId, recipeId: "recipe-a", name: "Dầu ăn", quantity: 20, unit: "ML", optional: false },
  ],
};
const mealItem = { id: mealItemId, dayId: "day-a", recipeId: recipe.id, mealType: "LUNCH", servings: 1, completed: false, calories: 300, recipe };
const pantryItem = (id: string, name: string, quantity: number, unit: string, expiryDate: Date | null) => ({
  id, userId, name, quantity, unit, expiryDate, category: "Khác", storageLocation: "REFRIGERATOR", minimumStock: 0, note: null,
  expiryEstimated: false, purchasedAt: day(-3), createdAt: day(-3), updatedAt: day(-3),
});
const tofuSoon = pantryItem("cm51111111111111111111111", "Đậu hũ", 150, "G", day(1));
const tofuLate = pantryItem("cm52222222222222222222222", "đậu hũ", 0.5, "KG", day(5));
const chili = pantryItem("cm53333333333333333333333", "Ớt", 50, "G", null);
const patch = (body: unknown, sub = userId) => request(app, `/api/meal-plans/items/${mealItemId}`, { method: "PATCH", token: token(sub), body });
const deductBody = { completed: true, consumption: { mode: "deduct", lines: [{ ingredientId: tofuId, quantity: 200, unit: "G" }, { ingredientId: oilId, quantity: 10, unit: "ML" }] } };
const historyData = () => mocks.createHistory.mock.calls.map(([args]) => args.data);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findFirstMealItem.mockResolvedValue(mealItem);
  mocks.updateMealItems.mockResolvedValue({ count: 1 });
  mocks.findMealItem.mockResolvedValue({ ...mealItem, recipe: undefined, completed: true });
  mocks.listPantry.mockResolvedValue([tofuLate, chili, tofuSoon]);
  mocks.updatePantry.mockResolvedValue({ count: 1 });
  mocks.createHistory.mockImplementation(async ({ data }) => ({ id: `tx-${mocks.createHistory.mock.calls.length}`, ...data }));
  mocks.listHistory.mockResolvedValue([]);
  mocks.updateHistory.mockResolvedValue({ count: 1 });
  mocks.countHistory.mockResolvedValue(0);
  mocks.syncNotifications.mockResolvedValue(0);
  mocks.transaction.mockImplementation(tx.run);
});

describe("GET /api/meal-plans/items/:id/consumption-preview", () => {
  it("previews one line per ingredient for the owner, without changing the pantry", async () => {
    const response = await request(app, `/api/meal-plans/items/${mealItemId}/consumption-preview`, { token: token() });
    expect(response.status).toBe(200);
    expect(mocks.findFirstMealItem).toHaveBeenCalledWith(expect.objectContaining({ where: { id: mealItemId, day: { mealPlan: { userId } } } }));
    expect(mocks.listPantry).toHaveBeenCalledWith({ where: { userId, quantity: { gt: 0 } } });
    const { lines, alreadyDeducted, recipe: summary } = response.body;
    expect(summary).toEqual({ id: "recipe-a", name: "Đậu hũ sốt cà", servings: 2 });
    expect(alreadyDeducted).toBe(false);
    expect(lines.map((line: { name: string; status: string; defaultQuantity: number }) => [line.name, line.status, line.defaultQuantity])).toEqual([
      ["Đậu hũ", "ENOUGH", 200], ["Ớt", "OPTIONAL", 0], ["Dầu ăn", "NOT_IN_PANTRY", 0],
    ]);
    expect(lines[0].required).toEqual({ quantity: 200, unit: "G" });
    expect(lines[0].deductions.map((d: { pantryItemId: string; quantity: number; unit: string }) => [d.pantryItemId, d.quantity, d.unit])).toEqual([
      [tofuSoon.id, 150, "G"], [tofuLate.id, 0.05, "KG"],
    ]);
    expect(mocks.updatePantry).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's meal and an invalid id is rejected first", async () => {
    mocks.findFirstMealItem.mockResolvedValue(null);
    expect(await request(app, `/api/meal-plans/items/${mealItemId}/consumption-preview`, { token: token(otherUserId) }))
      .toEqual({ status: 404, body: { message: "Không tìm thấy bữa ăn." } });
    expect((await request(app, "/api/meal-plans/items/not-a-cuid/consumption-preview", { token: token() })).status).toBe(422);
  });
});

describe("PATCH /api/meal-plans/items/:id — eaten → deduct from the pantry", () => {
  it("deducts soonest-expiring first, never below 0, records CONSUMPTION history in the same transaction", async () => {
    const response = await patch(deductBody);
    expect(response.status).toBe(200);
    expect(mocks.updateMealItems).toHaveBeenCalledWith({ where: { id: mealItemId, day: { mealPlan: { userId } }, completed: false }, data: { completed: true } });
    expect(mocks.updatePantry.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: tofuSoon.id, userId, quantity: 150 }, data: { quantity: 0 } },
      { where: { id: tofuLate.id, userId, quantity: 0.5 }, data: { quantity: 0.45 } },
    ]);
    expect(historyData()).toEqual([
      expect.objectContaining({ pantryItemId: tofuSoon.id, source: "CONSUMPTION", delta: -150, unit: "G", quantityAfter: 0, mealPlanItemId: mealItemId }),
      expect.objectContaining({ pantryItemId: tofuLate.id, source: "CONSUMPTION", delta: -0.05, unit: "KG", quantityAfter: 0.45, mealPlanItemId: mealItemId }),
    ]);
    for (const write of [mocks.updatePantry, mocks.createHistory]) {
      expect(tx.wasCalledInTransaction(mocks.transaction, write, 0)).toBe(true);
      expect(tx.wasCalledInTransaction(mocks.transaction, write, 1)).toBe(true);
    }
    const { consumption } = response.body;
    expect(consumption.lines.map((line: { name: string; status: string }) => [line.name, line.status])).toEqual([["Đậu hũ", "ENOUGH"], ["Dầu ăn", "NOT_IN_PANTRY"]]);
    expect(consumption.skippedIngredients).toEqual([{ ingredientId: chiliId, name: "Ớt" }]);
    expect(mocks.syncNotifications).toHaveBeenCalledWith(userId);
  });

  it("reads and writes only the owner's pantry", async () => {
    await patch(deductBody);
    expect(mocks.listPantry).toHaveBeenCalledWith({ where: { userId, quantity: { gt: 0 } } });
    expect(mocks.updatePantry.mock.calls.every(([args]) => args.where.userId === userId)).toBe(true);
  });

  it("a shortage deducts what exists and reports the rest", async () => {
    const response = await patch({ completed: true, consumption: { mode: "deduct", lines: [{ ingredientId: tofuId, quantity: 0.8, unit: "KG" }] } });
    const [line] = response.body.consumption.lines;
    expect(line).toMatchObject({ status: "SHORT", shortfall: 0.15 });
    expect(mocks.updatePantry.mock.calls.map(([args]) => args.data.quantity)).toEqual([0, 0]);
  });

  it("an optional ingredient is deducted only when the user includes it", async () => {
    await patch({ completed: true, consumption: { mode: "deduct", lines: [{ ingredientId: chiliId, quantity: 5, unit: "G" }] } });
    expect(mocks.updatePantry).toHaveBeenCalledWith({ where: { id: chili.id, userId, quantity: 50 }, data: { quantity: 45 } });
  });

  it("skips (and reports) a deduction if the item changed since it was read, without writing history for it", async () => {
    mocks.updatePantry.mockResolvedValueOnce({ count: 0 });
    const response = await patch(deductBody);
    expect(response.body.consumption.lines[0].skipped).toEqual([{ pantryItemId: tofuSoon.id, reason: "CHANGED" }]);
    expect(historyData().map((row) => row.pantryItemId)).toEqual([tofuLate.id]);
  });

  it.each([
    ["mode none", { completed: true, consumption: { mode: "none" } }],
    ["no consumption (old client)", { completed: true }],
  ])("%s: only marks the meal as eaten", async (_label, body) => {
    const response = await patch(body);
    expect(response.status).toBe(200);
    expect(mocks.updateMealItems).toHaveBeenCalled();
    expect(mocks.listPantry).not.toHaveBeenCalled();
    expect(mocks.updatePantry).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
  });

  it("does not deduct twice when the meal is already eaten", async () => {
    mocks.updateMealItems.mockResolvedValue({ count: 0 });
    const response = await patch(deductBody);
    expect(response.body).toMatchObject({ alreadyCompleted: true, consumption: null });
    expect(mocks.updatePantry).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's meal without touching any pantry", async () => {
    mocks.findFirstMealItem.mockResolvedValue(null);
    expect(await patch(deductBody, otherUserId)).toEqual({ status: 404, body: { message: "Không tìm thấy bữa ăn." } });
    expect(mocks.updateMealItems).not.toHaveBeenCalled();
    expect(mocks.updatePantry).not.toHaveBeenCalled();
  });

  it("rejects an ingredient that is not part of this meal's recipe (422, nothing deducted)", async () => {
    const response = await patch({ completed: true, consumption: { mode: "deduct", lines: [{ ingredientId: "cm49999999999999999999999", quantity: 1, unit: "G" }] } });
    expect(response).toMatchObject({ status: 422, body: { message: "Nguyên liệu không thuộc món của bữa này." } });
    expect(mocks.updatePantry).not.toHaveBeenCalled();
  });

  it.each([
    ["duplicate ingredient lines", { completed: true, consumption: { mode: "deduct", lines: [{ ingredientId: tofuId, quantity: 1, unit: "G" }, { ingredientId: tofuId, quantity: 2, unit: "G" }] } }],
    ["consumption when un-marking", { completed: false, consumption: { mode: "none" } }],
    ["negative quantity", { completed: true, consumption: { mode: "deduct", lines: [{ ingredientId: tofuId, quantity: -1, unit: "G" }] } }],
    ["unknown unit", { completed: true, consumption: { mode: "deduct", lines: [{ ingredientId: tofuId, quantity: 1, unit: "CUP" }] } }],
    ["unknown mode", { completed: true, consumption: { mode: "all" } }],
  ])("rejects %s before reading the database", async (_label, body) => {
    expect((await patch(body)).status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("a failed history write fails the whole request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createHistory.mockRejectedValue(new Error("history unavailable"));
    expect((await patch(deductBody)).status).toBe(500);
    expect(mocks.syncNotifications).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/meal-plans/items/:id — un-mark → restore exactly what was deducted", () => {
  const original = (id: string, pantryItemId: string | null, itemName: string, delta: number, unit: string) => ({
    id, userId, pantryItemId, itemName, delta, unit, quantityAfter: 0, source: "CONSUMPTION", mealPlanItemId: mealItemId,
    reversalOfId: null, reversedAt: null, createdAt: day(-1),
  });

  it("adds back to the current quantity (after a manual edit), converts a changed unit, reports deleted or unconvertible items", async () => {
    mocks.listHistory.mockResolvedValue([
      original("tx-a", tofuSoon.id, "Đậu hũ", -150, "G"),
      original("tx-b", tofuLate.id, "đậu hũ", -0.05, "KG"),
      original("tx-c", null, "Dầu ăn", -10, "ML"),
      original("tx-d", chili.id, "Ớt", -5, "G"),
    ]);
    mocks.findFirstPantry.mockImplementation(async ({ where }) => ({
      [tofuSoon.id]: { ...tofuSoon, quantity: 20 },
      [tofuLate.id]: { ...tofuLate, quantity: 450, unit: "G" },
      [chili.id]: { ...chili, quantity: 3, unit: "ITEM" },
    })[where.id] ?? null);
    const response = await patch({ completed: false });
    expect(response.status).toBe(200);
    expect(mocks.updateMealItems).toHaveBeenCalledWith({ where: { id: mealItemId, day: { mealPlan: { userId } }, completed: true }, data: { completed: false } });
    expect(mocks.listHistory).toHaveBeenCalledWith({
      where: { userId, mealPlanItemId: mealItemId, source: "CONSUMPTION", reversalOfId: null, reversedAt: null }, orderBy: { createdAt: "asc" },
    });
    expect(mocks.findFirstPantry.mock.calls.map(([args]) => args.where)).toEqual([
      { id: tofuSoon.id, userId }, { id: tofuLate.id, userId }, { id: chili.id, userId },
    ]);
    expect(mocks.updatePantry.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: tofuSoon.id, userId, quantity: 20 }, data: { quantity: 170 } },
      { where: { id: tofuLate.id, userId, quantity: 450 }, data: { quantity: 500 } },
    ]);
    expect(historyData()).toEqual([
      expect.objectContaining({ pantryItemId: tofuSoon.id, delta: 150, unit: "G", quantityAfter: 170, reversalOfId: "tx-a", source: "CONSUMPTION" }),
      expect.objectContaining({ pantryItemId: tofuLate.id, delta: 50, unit: "G", quantityAfter: 500, reversalOfId: "tx-b" }),
    ]);
    expect(mocks.updateHistory.mock.calls.map(([args]) => args.where)).toEqual(["tx-a", "tx-b", "tx-c", "tx-d"].map((id) => ({ id, reversedAt: null })));
    const { restoration } = response.body;
    expect(restoration.restored).toHaveLength(2);
    expect(restoration.skipped).toEqual([
      { itemName: "Dầu ăn", quantity: 10, unit: "ML", reason: "DELETED" },
      { itemName: "Ớt", quantity: 5, unit: "G", reason: "UNIT_MISMATCH" },
    ]);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.updateHistory, 0)).toBe(true);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createHistory, 0)).toBe(true);
  });

  it("never restores twice: a line already claimed by another reversal is skipped", async () => {
    mocks.listHistory.mockResolvedValue([original("tx-a", tofuSoon.id, "Đậu hũ", -150, "G")]);
    mocks.updateHistory.mockResolvedValue({ count: 0 });
    const response = await patch({ completed: false });
    expect(response.body.restoration).toEqual({ restored: [], skipped: [] });
    expect(mocks.updatePantry).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
  });

  it("a meal marked without deducting has nothing to restore", async () => {
    const response = await patch({ completed: false });
    expect(response.body.restoration).toEqual({ restored: [], skipped: [] });
    expect(mocks.syncNotifications).not.toHaveBeenCalled();
  });
});
