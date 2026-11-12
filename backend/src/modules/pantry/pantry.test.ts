import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import { manualEditChange } from "./pantry-history.service.js";
import pantryRoutes from "./pantry.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  list: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(),
  deleteManyItems: vi.fn(), deleteManyNotifications: vi.fn(), transaction: vi.fn(),
  createHistory: vi.fn(), listHistory: vi.fn(), countHistory: vi.fn(),
  syncNotifications: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../notifications/notifications.service.js", () => ({
  syncPantryNotifications: mocks.syncNotifications,
}));
const client = () => ({
  pantryItem: {
    findMany: mocks.list, create: mocks.create, findFirst: mocks.findFirst, updateMany: mocks.updateMany,
    findUnique: mocks.findUnique, deleteMany: mocks.deleteManyItems,
  },
  pantryTransaction: { create: mocks.createHistory, findMany: mocks.listHistory, count: mocks.countHistory },
  notification: { deleteMany: mocks.deleteManyNotifications },
});
const tx = fakeTransaction(client);
vi.mock("../../lib/prisma.js", () => ({ prisma: new Proxy({}, {
  get: (_target, key) => (key === "$transaction" ? mocks.transaction : Reflect.get(client(), key)),
}) }));

const app = testApp("/api/pantry", pantryRoutes);
const userId = "user-a";
const otherUserId = "user-b";
const itemId = "cm12345678901234567890123";
const token = (sub = userId) => `Bearer ${jwt.sign({ sub, email: `${sub}@nouri.vn` }, mocks.secret)}`;
const item = {
  id: itemId,
  userId,
  name: "Ức gà",
  category: "Thịt & cá",
  quantity: 500,
  unit: "G",
  storageLocation: "FREEZER",
  expiryDate: new Date("2026-09-20T00:00:00.000Z"),
  expiryEstimated: false,
  purchasedAt: new Date("2026-09-13T00:00:00.000Z"),
  minimumStock: 100,
  note: "Ngăn đông",
  createdAt: new Date("2026-09-13T00:00:00.000Z"),
  updatedAt: new Date("2026-09-13T00:00:00.000Z"),
};
const createBody = {
  name: item.name,
  category: item.category,
  quantity: item.quantity,
  unit: item.unit,
  storageLocation: item.storageLocation,
  expiryDate: "2026-09-20",
  minimumStock: item.minimumStock,
  note: item.note,
};
const notificationWhere = {
  userId,
  relatedId: itemId,
  type: { in: ["PANTRY_EXPIRING", "PANTRY_EXPIRED", "PANTRY_LOW_STOCK"] },
};
const historyData = () => mocks.createHistory.mock.calls.map(([args]) => args.data);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue([item]);
  mocks.create.mockResolvedValue(item);
  mocks.findFirst.mockResolvedValue(item);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findUnique.mockResolvedValue(item);
  mocks.deleteManyItems.mockResolvedValue({ count: 1 });
  mocks.deleteManyNotifications.mockResolvedValue({ count: 1 });
  mocks.createHistory.mockImplementation(async ({ data }) => ({ id: "tx-1", ...data }));
  mocks.syncNotifications.mockResolvedValue(1);
  mocks.transaction.mockImplementation(tx.run);
});

describe("Pantry HTTP contract and ownership (no database)", () => {
  it("lists only the authenticated user's items using the existing order", async () => {
    const response = await request(app, "/api/pantry?userId=user-b", { token: token() });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify([item])) });
    expect(mocks.list).toHaveBeenCalledWith({
      where: { userId }, orderBy: [{ expiryDate: "asc" }, { name: "asc" }],
    });
  });

  it("creates an item for the token owner, converts the date to UTC and syncs notifications", async () => {
    const response = await request(app, "/api/pantry", {
      method: "POST", token: token(), body: { ...createBody, userId: otherUserId },
    });
    expect(response).toEqual({ status: 201, body: JSON.parse(JSON.stringify(item)) });
    expect(mocks.create).toHaveBeenCalledWith({ data: {
      userId, ...createBody, expiryDate: new Date("2026-09-20T00:00:00.000Z"),
    } });
    expect(mocks.syncNotifications).toHaveBeenCalledWith(userId);
  });

  it("trims and normalizes name and category before creating", async () => {
    await request(app, "/api/pantry", {
      method: "POST", token: token(), body: { ...createBody, name: "  Ức   gà  ", category: " Thịt   & cá " },
    });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ name: "Ức gà", category: "Thịt & cá" });
  });

  it("stores a missing or null create expiry date as null and never accepts expiryEstimated from the client", async () => {
    const { expiryDate: _expiryDate, ...withoutExpiry } = createBody;
    await request(app, "/api/pantry", { method: "POST", token: token(), body: { ...withoutExpiry, expiryEstimated: true } });
    expect(mocks.create.mock.calls[0][0].data.expiryDate).toBeNull();
    expect(mocks.create.mock.calls[0][0].data).not.toHaveProperty("expiryEstimated");
  });

  it("updates by id and owner, cleans old pantry notifications, then resyncs", async () => {
    const response = await request(app, `/api/pantry/${itemId}`, {
      method: "PUT", token: token(), body: {
        name: "  Ức   gà  ", category: " Thịt   & cá ",
        quantity: 250, minimumStock: 75, storageLocation: "DRY_STORAGE",
        expiryDate: "2026-09-20", userId: otherUserId,
      },
    });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify(item)) });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: itemId, userId } });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: itemId, userId },
      data: {
        name: "Ức gà", category: "Thịt & cá",
        quantity: 250, minimumStock: 75, storageLocation: "DRY_STORAGE",
        expiryDate: new Date("2026-09-20T00:00:00.000Z"),
      },
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: itemId } });
    expect(mocks.deleteManyNotifications).toHaveBeenCalledWith({ where: notificationWhere });
    expect(mocks.syncNotifications).toHaveBeenCalledWith(userId);
  });

  it.each(["POST", "PUT"])("keeps a successful %s response when notification sync fails after commit", async (method) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.syncNotifications.mockRejectedValue(new Error("notification unavailable"));
    const response = await request(app, method === "POST" ? "/api/pantry" : `/api/pantry/${itemId}`, {
      method, token: token(), body: method === "POST" ? createBody : { quantity: 250 },
    });
    expect(response.status).toBe(method === "POST" ? 201 : 200);
    expect(consoleError).toHaveBeenCalledWith(
      "Không thể đồng bộ thông báo Pantry sau khi đã lưu dữ liệu.", expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("preserves an explicit null expiry date on partial update (a changed expiry is no longer estimated)", async () => {
    await request(app, `/api/pantry/${itemId}`, {
      method: "PUT", token: token(), body: { expiryDate: null },
    });
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({ expiryDate: null, expiryEstimated: false });
  });

  it("returns 404 when the authenticated user does not own the update target", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await request(app, `/api/pantry/${itemId}`, {
      method: "PUT", token: token(otherUserId), body: { quantity: 250 },
    });
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy thực phẩm." } });
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: itemId, userId: otherUserId } });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
    expect(mocks.deleteManyNotifications).not.toHaveBeenCalled();
    expect(mocks.syncNotifications).not.toHaveBeenCalled();
  });

  it("deletes only an owned item and its related pantry notifications in one transaction", async () => {
    const response = await request(app, `/api/pantry/${itemId}?reason=DISCARDED`, { method: "DELETE", token: token() });
    expect(response).toEqual({ status: 204, body: null });
    expect(mocks.deleteManyItems).toHaveBeenCalledWith({ where: { id: itemId, userId } });
    expect(mocks.deleteManyNotifications).toHaveBeenCalledWith({ where: notificationWhere });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 404 without deleting anything or writing history when the item is not owned", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await request(app, `/api/pantry/${itemId}?reason=USED_UP`, { method: "DELETE", token: token(otherUserId) });
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy thực phẩm." } });
    expect(mocks.deleteManyItems).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
    expect(mocks.deleteManyNotifications).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/pantry", undefined],
    ["GET", "/api/pantry/transactions", undefined],
    ["POST", "/api/pantry", createBody],
    ["PUT", `/api/pantry/${itemId}`, { quantity: 1 }],
    ["DELETE", `/api/pantry/${itemId}`, undefined],
  ])("requires authentication for %s %s", async (method, path, body) => {
    expect(await request(app, path, { method, body })).toEqual({
      status: 401, body: { message: "Bạn cần đăng nhập để tiếp tục." },
    });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.listHistory).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("Pantry history is written with every stock change, in the same transaction", () => {
  it("adding an item writes MANUAL_ADD with the full quantity", async () => {
    await request(app, "/api/pantry", { method: "POST", token: token(), body: createBody });
    expect(historyData()).toEqual([{
      userId, pantryItemId: itemId, itemName: "Ức gà", unit: "G", delta: 500, quantityAfter: 500, source: "MANUAL_ADD",
      note: null, mealPlanItemId: null, shoppingItemId: null, receiptScanId: null, reversalOfId: null,
      removalReason: null, category: expect.any(String), expiryDate: expect.anything(), unitPrice: null,
    }]);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.create)).toBe(true);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createHistory)).toBe(true);
  });

  it("editing the quantity writes MANUAL_EDIT with the difference", async () => {
    mocks.findUnique.mockResolvedValue({ ...item, quantity: 320 });
    await request(app, `/api/pantry/${itemId}`, { method: "PUT", token: token(), body: { quantity: 320 } });
    expect(historyData()).toMatchObject([{ source: "MANUAL_EDIT", delta: -180, quantityAfter: 320, unit: "G", note: null }]);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createHistory)).toBe(true);
  });

  it("editing only name, expiry or note writes no history", async () => {
    mocks.findUnique.mockResolvedValue({ ...item, name: "Ức gà phi lê", note: "Mua chợ" });
    await request(app, `/api/pantry/${itemId}`, { method: "PUT", token: token(), body: { name: "Ức gà phi lê", note: "Mua chợ", quantity: 500 } });
    expect(mocks.createHistory).not.toHaveBeenCalled();
  });

  it("changing the unit converts g ↔ kg; a unit that cannot be converted resets the quantity with a note", async () => {
    mocks.findUnique.mockResolvedValue({ ...item, quantity: 0.8, unit: "KG" });
    await request(app, `/api/pantry/${itemId}`, { method: "PUT", token: token(), body: { quantity: 0.8, unit: "KG" } });
    expect(historyData()[0]).toMatchObject({ delta: 0.3, quantityAfter: 0.8, unit: "KG", note: "Đổi đơn vị: 500 g → 0,8 kg" });
    mocks.createHistory.mockClear();
    mocks.findUnique.mockResolvedValue({ ...item, quantity: 2, unit: "ITEM" });
    await request(app, `/api/pantry/${itemId}`, { method: "PUT", token: token(), body: { quantity: 2, unit: "ITEM" } });
    expect(historyData()[0]).toMatchObject({ delta: 2, quantityAfter: 2, unit: "ITEM", note: "Đổi đơn vị: 500 g → 2 cái" });
  });

  it("deleting writes MANUAL_DELETE with the removed quantity before the row is deleted", async () => {
    await request(app, `/api/pantry/${itemId}?reason=DISCARDED`, { method: "DELETE", token: token() });
    expect(historyData()).toMatchObject([{
      source: "MANUAL_DELETE", delta: -500, quantityAfter: 0, itemName: "Ức gà", pantryItemId: itemId, removalReason: "DISCARDED",
    }]);
    expect(mocks.createHistory.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteManyItems.mock.invocationCallOrder[0]);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createHistory)).toBe(true);
  });

  it("xóa cần lý do (Đã dùng hết / Bỏ đi / Nhập nhầm); thiếu hoặc lạ → 422, không xóa", async () => {
    for (const path of [`/api/pantry/${itemId}`, `/api/pantry/${itemId}?reason=LOST`]) {
      expect((await request(app, path, { method: "DELETE", token: token() })).status).toBe(422);
    }
    expect(mocks.deleteManyItems).not.toHaveBeenCalled();
  });

  it("a history write failure fails the whole change (500), so no stock change goes unrecorded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createHistory.mockRejectedValue(new Error("history unavailable"));
    const response = await request(app, "/api/pantry", { method: "POST", token: token(), body: createBody });
    expect(response.status).toBe(500);
    expect(mocks.syncNotifications).not.toHaveBeenCalled();
  });

  it("keeps expiryEstimated when the form resends the same expiry date, resets it when the date changes", async () => {
    mocks.findFirst.mockResolvedValue({ ...item, expiryEstimated: true });
    await request(app, `/api/pantry/${itemId}`, { method: "PUT", token: token(), body: { expiryDate: "2026-09-20", quantity: 500 } });
    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty("expiryEstimated");
    await request(app, `/api/pantry/${itemId}`, { method: "PUT", token: token(), body: { expiryDate: "2026-09-25" } });
    expect(mocks.updateMany.mock.calls[1][0].data).toMatchObject({ expiryEstimated: false });
  });

  it("manualEditChange ignores unchanged stock and rounds float noise", () => {
    const base = { id: itemId, userId, name: "Sữa", quantity: 0.3, unit: "L" as const };
    expect(manualEditChange(base, { ...base })).toBeNull();
    expect(manualEditChange(base, { ...base, quantity: 0.1 + 0.2 + 0.1 })?.delta).toBeCloseTo(0.1);
  });
});

describe("GET /api/pantry/transactions", () => {
  const row = { id: "tx-1", itemName: "Ức gà", unit: "G", delta: -180, quantityAfter: 320, source: "MANUAL_EDIT", createdAt: new Date("2026-11-03T08:00:00.000Z") };
  beforeEach(() => {
    mocks.listHistory.mockResolvedValue([row]);
    mocks.countHistory.mockResolvedValue(41);
  });

  it("lists only the token owner's history, newest first, 20 per page by default", async () => {
    const response = await request(app, "/api/pantry/transactions?userId=user-b", { token: token() });
    expect(response).toEqual({ status: 200, body: { items: JSON.parse(JSON.stringify([row])), total: 41, page: 1, pageSize: 20 } });
    const query = mocks.listHistory.mock.calls[0][0];
    expect(query.where).toEqual({ userId });
    expect(query).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 0, take: 20 });
    expect(mocks.countHistory).toHaveBeenCalledWith({ where: { userId } });
  });

  it("filters by source and by one pantry item, still scoped to the owner", async () => {
    await request(app, `/api/pantry/transactions?source=CONSUMPTION&pantryItemId=${itemId}&page=3&pageSize=10`, { token: token() });
    expect(mocks.listHistory.mock.calls[0][0]).toMatchObject({ where: { userId, source: "CONSUMPTION", pantryItemId: itemId }, skip: 20, take: 10 });
  });

  it("returns links to the meal or shopping line, never other users' data", async () => {
    await request(app, "/api/pantry/transactions", { token: token(otherUserId) });
    const { where, select } = mocks.listHistory.mock.calls[0][0];
    expect(where).toEqual({ userId: otherUserId });
    expect(Object.keys(select)).toEqual(expect.arrayContaining(["mealPlanItem", "shoppingItem", "reversalOfId", "reversedAt"]));
    expect(select).not.toHaveProperty("userId");
  });

  it.each([
    "source=EATEN", "pageSize=51", "page=0", "pantryItemId=not-a-cuid", "page=abc",
  ])("rejects an invalid query (%s) before reading the database", async (query) => {
    const response = await request(app, `/api/pantry/transactions?${query}`, { token: token() });
    expect(response.status).toBe(422);
    expect(mocks.listHistory).not.toHaveBeenCalled();
  });
});

describe("Pantry validation", () => {
  it.each([
    { ...createBody, name: "" },
    { ...createBody, name: "   " },
    { ...createBody, category: "" },
    { ...createBody, category: "   " },
    { ...createBody, quantity: -1 },
    { ...createBody, unit: "BOX" },
    { ...createBody, storageLocation: "CUPBOARD" },
    { ...createBody, expiryDate: "20-09-2026" },
    { ...createBody, minimumStock: -1 },
    { ...createBody, note: "x".repeat(301) },
  ])("rejects an invalid create payload %#", async (body) => {
    const response = await request(app, "/api/pantry", { method: "POST", token: token(), body });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects invalid update data before checking ownership", async () => {
    const response = await request(app, `/api/pantry/${itemId}`, {
      method: "PUT", token: token(), body: { quantity: -1 },
    });
    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["PUT", "DELETE"])("rejects an invalid id for %s", async (method) => {
    const response = await request(app, "/api/pantry/not-a-cuid", {
      method, token: token(), body: method === "PUT" ? { quantity: 1 } : undefined,
    });
    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
