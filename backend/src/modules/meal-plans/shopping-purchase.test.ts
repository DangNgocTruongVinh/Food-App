import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import mealPlanRoutes from "./meal-plans.routes.js";
import { PURCHASE_CREATED_NOTE, PURCHASE_REUSED_NOTE } from "./shopping-purchase.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findShopping: vi.fn(), updateShopping: vi.fn(),
  listPantry: vi.fn(), createPantry: vi.fn(), updatePantry: vi.fn(), findFirstPantry: vi.fn(), deletePantry: vi.fn(),
  createHistory: vi.fn(), listHistory: vi.fn(), updateHistory: vi.fn(), countHistory: vi.fn(),
  transaction: vi.fn(), syncNotifications: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../notifications/notifications.service.js", () => ({ syncPantryNotifications: mocks.syncNotifications }));
const client = () => ({
  shoppingItem: { findFirst: mocks.findShopping, updateMany: mocks.updateShopping },
  pantryItem: {
    findMany: mocks.listPantry, create: mocks.createPantry, updateMany: mocks.updatePantry, findFirst: mocks.findFirstPantry, deleteMany: mocks.deletePantry,
  },
  pantryTransaction: { create: mocks.createHistory, findMany: mocks.listHistory, updateMany: mocks.updateHistory, count: mocks.countHistory },
});
const tx = fakeTransaction(client);
vi.mock("../../lib/prisma.js", () => ({ prisma: new Proxy({}, {
  get: (_target, key) => (key === "$transaction" ? mocks.transaction : Reflect.get(client(), key)),
}) }));

const app = testApp("/api/meal-plans", mealPlanRoutes);
const userId = "user-a";
const otherUserId = "user-b";
const shoppingId = "cm32345678901234567890123";
const token = (sub = userId) => `Bearer ${jwt.sign({ sub, email: `${sub}@nouri.vn` }, mocks.secret)}`;
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const shopping = { id: shoppingId, mealPlanId: "plan-a", name: "Đậu hũ", quantity: 300, unit: "G", purchased: false, category: "Đậu & hạt" };
const pantryItem = (id: string, name: string, quantity: number, unit: string, expiryDate: Date | null, extra = {}) => ({
  id, userId, name, quantity, unit, expiryDate, category: "Đậu & hạt", storageLocation: "REFRIGERATOR", minimumStock: 0, note: null,
  expiryEstimated: false, purchasedAt: day(-3), createdAt: day(-3), updatedAt: day(-3), ...extra,
});
const patch = (purchased: boolean, sub = userId) => request(app, `/api/meal-plans/shopping/${shoppingId}`, { method: "PATCH", token: token(sub), body: { purchased } });
const historyData = () => mocks.createHistory.mock.calls.map(([args]) => args.data);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findShopping.mockResolvedValue(shopping);
  mocks.updateShopping.mockResolvedValue({ count: 1 });
  mocks.listPantry.mockResolvedValue([]);
  mocks.createPantry.mockImplementation(async ({ data }) => ({ id: "cm60000000000000000000000", minimumStock: 0, note: null, ...data }));
  mocks.updatePantry.mockResolvedValue({ count: 1 });
  mocks.deletePantry.mockResolvedValue({ count: 1 });
  mocks.createHistory.mockImplementation(async ({ data }) => ({ id: `tx-${mocks.createHistory.mock.calls.length}`, ...data }));
  mocks.listHistory.mockResolvedValue([]);
  mocks.updateHistory.mockResolvedValue({ count: 1 });
  mocks.countHistory.mockResolvedValue(0);
  mocks.syncNotifications.mockResolvedValue(0);
  mocks.transaction.mockImplementation(tx.run);
});

describe("Tick \"Đã mua\" → pantry", () => {
  it("merges into the same-name item with the latest expiry, converting units, and records PURCHASE in the transaction", async () => {
    const soon = pantryItem("cm51111111111111111111111", "Đậu hũ", 100, "G", day(1));
    const late = pantryItem("cm52222222222222222222222", "đậu hũ", 0.2, "KG", day(3));
    mocks.listPantry.mockResolvedValue([soon, late]);
    const response = await patch(true);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: shoppingId, purchased: true, category: "Đậu & hạt", alreadyPurchased: false, restoration: null,
      pantry: { action: "MERGED", pantryItemId: late.id, name: "đậu hũ", quantity: 0.3, unit: "KG", quantityAfter: 0.5, expiryEstimated: false },
    });
    expect(mocks.updateShopping).toHaveBeenCalledWith({ where: { id: shoppingId, mealPlan: { userId }, purchased: false }, data: { purchased: true } });
    expect(mocks.listPantry).toHaveBeenCalledWith({ where: { userId } });
    expect(mocks.updatePantry).toHaveBeenCalledWith({ where: { id: late.id, userId, quantity: 0.2 }, data: { quantity: 0.5 } });
    expect(mocks.createPantry).not.toHaveBeenCalled();
    expect(historyData()).toEqual([expect.objectContaining({
      userId, pantryItemId: late.id, delta: 0.3, quantityAfter: 0.5, unit: "KG", source: "PURCHASE", shoppingItemId: shoppingId, note: null,
    })]);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.updatePantry)).toBe(true);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createHistory)).toBe(true);
    expect(mocks.syncNotifications).toHaveBeenCalledWith(userId);
  });

  it("reuses a depleted same-name item with a new suggested expiry", async () => {
    const depleted = pantryItem("cm51111111111111111111111", "Đậu hũ", 0, "G", day(-5));
    mocks.listPantry.mockResolvedValue([depleted]);
    const response = await patch(true);
    expect(response.body.pantry).toMatchObject({ action: "REUSED", pantryItemId: depleted.id, quantity: 300, quantityAfter: 300, expiryEstimated: true });
    const update = mocks.updatePantry.mock.calls[0][0];
    expect(update.where).toEqual({ id: depleted.id, userId, quantity: 0 });
    expect(update.data).toMatchObject({ quantity: 300, expiryEstimated: true });
    expect(update.data.expiryDate.getTime()).toBeGreaterThan(Date.now());
    expect(historyData()[0]).toMatchObject({ delta: 300, quantityAfter: 300, source: "PURCHASE", note: PURCHASE_REUSED_NOTE });
  });

  it("creates a new item with category, storage and suggested expiry (fresh tofu vs dry peanuts), marked estimated", async () => {
    await patch(true);
    const created = mocks.createPantry.mock.calls[0][0].data;
    expect(created).toMatchObject({
      userId, name: "Đậu hũ", unit: "G", quantity: 300, category: "Đậu & hạt", storageLocation: "REFRIGERATOR", expiryEstimated: true,
    });
    expect(created.createdAt).toEqual(created.updatedAt);
    const days = Math.round((created.expiryDate.getTime() - created.createdAt.getTime()) / 86_400_000);
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(3);
    expect(historyData()[0]).toMatchObject({ delta: 300, quantityAfter: 300, source: "PURCHASE", shoppingItemId: shoppingId, note: PURCHASE_CREATED_NOTE });

    vi.clearAllMocks();
    mocks.findShopping.mockResolvedValue({ ...shopping, name: "Đậu phộng", quantity: 50 });
    await patch(true);
    expect(mocks.createPantry.mock.calls[0][0].data).toMatchObject({ name: "Đậu phộng", storageLocation: "DRY_STORAGE", category: "Đậu & hạt" });
  });

  it("does not merge into an expired item or one in another unit; creates a new item instead", async () => {
    mocks.listPantry.mockResolvedValue([
      pantryItem("cm51111111111111111111111", "Đậu hũ", 200, "G", day(-2)),
      pantryItem("cm52222222222222222222222", "Đậu hũ", 2, "ITEM", null),
    ]);
    const response = await patch(true);
    expect(response.body.pantry.action).toBe("CREATED");
    expect(mocks.updatePantry).not.toHaveBeenCalled();
  });

  it("ticking again does not add a second time", async () => {
    mocks.updateShopping.mockResolvedValue({ count: 0 });
    mocks.findShopping.mockResolvedValue({ ...shopping, purchased: true });
    const response = await patch(true);
    expect(response.body).toMatchObject({ purchased: true, alreadyPurchased: true, pantry: null });
    expect(mocks.listPantry).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
    expect(mocks.syncNotifications).not.toHaveBeenCalled();
  });

  it("returns 404 for a shopping line of another user, without touching the pantry", async () => {
    mocks.findShopping.mockResolvedValue(null);
    expect(await patch(true, otherUserId)).toEqual({ status: 404, body: { message: "Không tìm thấy nguyên liệu mua sắm." } });
    expect(mocks.findShopping).toHaveBeenCalledWith({ where: { id: shoppingId, mealPlan: { userId: otherUserId } } });
    expect(mocks.updateShopping).not.toHaveBeenCalled();
    expect(mocks.listPantry).not.toHaveBeenCalled();
  });

  it("rolls the purchase back (409) when the pantry item changed meanwhile", async () => {
    mocks.listPantry.mockResolvedValue([pantryItem("cm51111111111111111111111", "Đậu hũ", 100, "G", day(2))]);
    mocks.updatePantry.mockResolvedValue({ count: 0 });
    expect((await patch(true)).status).toBe(409);
    expect(mocks.createHistory).not.toHaveBeenCalled();
  });

  it("fails the whole change (500) when writing history fails", async () => {
    mocks.createHistory.mockRejectedValue(new Error("history down"));
    expect((await patch(true)).status).toBe(500);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createPantry)).toBe(true);
  });
});

describe("Untick \"Đã mua\" → restore", () => {
  const createdAt = day(-1);
  const original = (extra = {}) => ({
    id: "cm70000000000000000000000", userId, pantryItemId: "cm60000000000000000000000", itemName: "Đậu hũ", unit: "G", delta: 300, quantityAfter: 300,
    source: "PURCHASE", note: PURCHASE_CREATED_NOTE, shoppingItemId: shoppingId, reversalOfId: null, reversedAt: null, createdAt, ...extra,
  });
  const created = (extra = {}) => pantryItem("cm60000000000000000000000", "Đậu hũ", 300, "G", day(2), { createdAt, updatedAt: createdAt, expiryEstimated: true, ...extra });

  beforeEach(() => {
    mocks.findShopping.mockResolvedValue({ ...shopping, purchased: true });
    mocks.listHistory.mockResolvedValue([original()]);
  });

  it("deletes an item created by this purchase and untouched since, recording the reversal first", async () => {
    mocks.findFirstPantry.mockResolvedValue(created());
    const response = await patch(false);
    expect(response.body).toMatchObject({
      purchased: false, pantry: null,
      restoration: { restored: [{ pantryItemId: "cm60000000000000000000000", quantity: 300, quantityAfter: 0, removed: true }], skipped: [] },
    });
    expect(mocks.updateShopping).toHaveBeenCalledWith({ where: { id: shoppingId, mealPlan: { userId }, purchased: true }, data: { purchased: false } });
    expect(mocks.listHistory).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, shoppingItemId: shoppingId, source: "PURCHASE", reversalOfId: null, reversedAt: null },
    }));
    expect(mocks.updateHistory).toHaveBeenCalledWith({ where: { id: "cm70000000000000000000000", reversedAt: null }, data: { reversedAt: expect.any(Date) } });
    expect(mocks.findFirstPantry).toHaveBeenCalledWith({ where: { id: "cm60000000000000000000000", userId } });
    expect(historyData()).toEqual([expect.objectContaining({ delta: -300, quantityAfter: 0, reversalOfId: "cm70000000000000000000000", source: "PURCHASE" })]);
    expect(mocks.deletePantry).toHaveBeenCalledWith({ where: { id: "cm60000000000000000000000", userId, quantity: 300 } });
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.deletePantry)).toBe(true);
  });

  it.each([
    ["was edited (name, expiry, note…)", { updatedAt: new Date(createdAt.getTime() + 60_000) }, 0],
    ["has other history (e.g. eaten from)", {}, 1],
  ])("subtracts instead of deleting when the created item %s", async (_label, extra, others) => {
    mocks.findFirstPantry.mockResolvedValue(created(extra));
    mocks.countHistory.mockResolvedValue(others);
    const response = await patch(false);
    expect(mocks.deletePantry).not.toHaveBeenCalled();
    expect(mocks.updatePantry).toHaveBeenCalledWith({ where: { id: "cm60000000000000000000000", userId, quantity: 300 }, data: { quantity: 0 } });
    expect(response.body.restoration.restored).toEqual([expect.objectContaining({ quantity: 300, quantityAfter: 0, removed: false })]);
  });

  it("subtracts a merged purchase in the item's current unit, never below 0, and reports what could not be taken back", async () => {
    mocks.listHistory.mockResolvedValue([original({ note: null, unit: "KG", delta: 0.3, quantityAfter: 0.5 })]);
    mocks.findFirstPantry.mockResolvedValue(pantryItem("cm60000000000000000000000", "Đậu hũ", 100, "G", day(3)));
    const response = await patch(false);
    expect(mocks.updatePantry).toHaveBeenCalledWith({ where: { id: "cm60000000000000000000000", userId, quantity: 100 }, data: { quantity: 0 } });
    expect(response.body.restoration).toEqual({
      restored: [{ pantryItemId: "cm60000000000000000000000", name: "Đậu hũ", quantity: 100, unit: "G", quantityAfter: 0, removed: false }],
      skipped: [{ itemName: "Đậu hũ", quantity: 200, unit: "G", reason: "INSUFFICIENT" }],
    });
    expect(historyData()[0]).toMatchObject({ delta: -100, quantityAfter: 0, reversalOfId: "cm70000000000000000000000" });
  });

  it("reports a deleted item or a unit that cannot be converted, without recreating anything", async () => {
    mocks.listHistory.mockResolvedValue([original(), original({ id: "cm71111111111111111111111", note: null, pantryItemId: "cm61111111111111111111111" })]);
    mocks.findFirstPantry.mockResolvedValueOnce(null).mockResolvedValueOnce(pantryItem("cm61111111111111111111111", "Đậu hũ", 2, "ITEM", null));
    const response = await patch(false);
    expect(response.body.restoration).toEqual({
      restored: [],
      skipped: [{ itemName: "Đậu hũ", quantity: 300, unit: "G", reason: "DELETED" }, { itemName: "Đậu hũ", quantity: 300, unit: "G", reason: "UNIT_MISMATCH" }],
    });
    expect(mocks.createPantry).not.toHaveBeenCalled();
    expect(mocks.updatePantry).not.toHaveBeenCalled();
    expect(mocks.syncNotifications).not.toHaveBeenCalled();
  });

  it("never restores twice: a purchase already claimed by another request is skipped", async () => {
    mocks.updateHistory.mockResolvedValue({ count: 0 });
    const response = await patch(false);
    expect(response.body.restoration).toEqual({ restored: [], skipped: [] });
    expect(mocks.findFirstPantry).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
  });
});
