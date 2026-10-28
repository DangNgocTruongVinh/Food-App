import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import pantryRoutes from "./pantry.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  list: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(),
  deleteManyItems: vi.fn(), deleteManyNotifications: vi.fn(), transaction: vi.fn(),
  syncNotifications: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../notifications/notifications.service.js", () => ({
  syncPantryNotifications: mocks.syncNotifications,
}));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  pantryItem: { findMany: mocks.list, create: mocks.create },
  $transaction: mocks.transaction,
} }));

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

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue([item]);
  mocks.create.mockResolvedValue(item);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findUnique.mockResolvedValue(item);
  mocks.deleteManyItems.mockResolvedValue({ count: 1 });
  mocks.deleteManyNotifications.mockResolvedValue({ count: 1 });
  mocks.syncNotifications.mockResolvedValue(1);
  mocks.transaction.mockImplementation((operation) => operation({
    pantryItem: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
      deleteMany: mocks.deleteManyItems,
    },
    notification: { deleteMany: mocks.deleteManyNotifications },
  }));
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

  it("stores a missing or null create expiry date as null", async () => {
    const { expiryDate: _expiryDate, ...withoutExpiry } = createBody;
    await request(app, "/api/pantry", { method: "POST", token: token(), body: withoutExpiry });
    expect(mocks.create.mock.calls[0][0].data.expiryDate).toBeNull();
  });

  it("updates by id and owner, cleans old pantry notifications, then resyncs", async () => {
    const response = await request(app, `/api/pantry/${itemId}`, {
      method: "PUT", token: token(), body: {
        name: "  Ức   gà  ", category: " Thịt   & cá ",
        quantity: 250, minimumStock: 75, storageLocation: "DRY_STORAGE",
        expiryDate: "2026-09-21", userId: otherUserId,
      },
    });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify(item)) });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: itemId, userId },
      data: {
        name: "Ức gà", category: "Thịt & cá",
        quantity: 250, minimumStock: 75, storageLocation: "DRY_STORAGE",
        expiryDate: new Date("2026-09-21T00:00:00.000Z"),
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

  it("preserves an explicit null expiry date on partial update", async () => {
    await request(app, `/api/pantry/${itemId}`, {
      method: "PUT", token: token(), body: { expiryDate: null },
    });
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({ expiryDate: null });
  });

  it("returns 404 when the authenticated user does not own the update target", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const response = await request(app, `/api/pantry/${itemId}`, {
      method: "PUT", token: token(otherUserId), body: { quantity: 250 },
    });
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy thực phẩm." } });
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: itemId, userId: otherUserId } }));
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.deleteManyNotifications).not.toHaveBeenCalled();
    expect(mocks.syncNotifications).not.toHaveBeenCalled();
  });

  it("deletes only an owned item and its related pantry notifications in one transaction", async () => {
    const response = await request(app, `/api/pantry/${itemId}`, { method: "DELETE", token: token() });
    expect(response).toEqual({ status: 204, body: null });
    expect(mocks.deleteManyItems).toHaveBeenCalledWith({ where: { id: itemId, userId } });
    expect(mocks.deleteManyNotifications).toHaveBeenCalledWith({ where: notificationWhere });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("returns 404 without deleting notifications when the item is not owned", async () => {
    mocks.deleteManyItems.mockResolvedValue({ count: 0 });
    const response = await request(app, `/api/pantry/${itemId}`, { method: "DELETE", token: token(otherUserId) });
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy thực phẩm." } });
    expect(mocks.deleteManyNotifications).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/pantry", undefined],
    ["POST", "/api/pantry", createBody],
    ["PUT", `/api/pantry/${itemId}`, { quantity: 1 }],
    ["DELETE", `/api/pantry/${itemId}`, undefined],
  ])("requires authentication for %s %s", async (method, path, body) => {
    expect(await request(app, path, { method, body })).toEqual({
      status: 401, body: { message: "Bạn cần đăng nhập để tiếp tục." },
    });
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
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
