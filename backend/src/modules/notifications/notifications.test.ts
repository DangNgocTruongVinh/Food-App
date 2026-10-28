import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import notificationsRoutes from "./notifications.routes.js";
import {
  buildPantryNotificationCandidates,
  normalizeNotificationListQuery,
  syncPantryNotifications,
} from "./notifications.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findPantryItems: vi.fn(),
  createNotifications: vi.fn(),
  findNotifications: vi.fn(),
  countNotifications: vi.fn(),
  updateNotifications: vi.fn(),
  findNotification: vi.fn(),
  updateNotification: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    pantryItem: { findMany: mocks.findPantryItems },
    notification: {
      createMany: mocks.createNotifications,
      findMany: mocks.findNotifications,
      count: mocks.countNotifications,
      updateMany: mocks.updateNotifications,
      findFirst: mocks.findNotification,
      update: mocks.updateNotification,
    },
  },
}));

const app = testApp("/api/notifications", notificationsRoutes);
const userId = "cm11111111111111111111111";
const otherUserId = "cm22222222222222222222222";
const notificationId = "cm33333333333333333333333";
const pantryId = "cm44444444444444444444444";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "member@nouri.vn" }, mocks.secret)}`;
const now = new Date("2026-08-20T10:00:00.000Z");
const notification = {
  id: notificationId,
  userId,
  type: "PANTRY_EXPIRING",
  title: "Thực phẩm sắp hết hạn",
  message: "Ức gà sẽ hết hạn sau 2 ngày.",
  isRead: false,
  relatedId: pantryId,
  actionUrl: `/pantry?item=${encodeURIComponent(pantryId)}`,
  dedupeKey: `pantry-expiring:${pantryId}:2026-08-22`,
  createdAt: now,
};

function pantryItem(overrides: Partial<{
  id: string;
  userId: string;
  name: string;
  quantity: number;
  minimumStock: number;
  expiryDate: Date | null;
  updatedAt: Date;
}> = {}) {
  return {
    id: pantryId,
    userId,
    name: "Ức gà",
    quantity: 500,
    minimumStock: 0,
    expiryDate: null,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findPantryItems.mockResolvedValue([]);
  mocks.createNotifications.mockResolvedValue({ count: 0 });
  mocks.findNotifications.mockResolvedValue([notification]);
  mocks.countNotifications.mockResolvedValue(1);
  mocks.updateNotifications.mockResolvedValue({ count: 1 });
  mocks.findNotification.mockResolvedValue(notification);
  mocks.updateNotification.mockResolvedValue({ ...notification, isRead: true });
});

describe("Notifications HTTP contract (mock Prisma, no database)", () => {
  it("lists the token owner's notifications newest first with the existing default limit", async () => {
    const response = await request(app, "/api/notifications", { token: token() });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([JSON.parse(JSON.stringify(notification))]);
    expect(mocks.findNotifications).toHaveBeenCalledWith({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  it("supports the existing unread filter and clamps the requested limit to 200", async () => {
    await request(app, "/api/notifications?filter=unread&limit=500", { token: token() });
    expect(mocks.findNotifications).toHaveBeenCalledWith({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

  it("preserves existing limit normalization", () => {
    expect(normalizeNotificationListQuery({ filter: "other", limit: "invalid" })).toEqual({ unreadOnly: false, limit: 100 });
    expect(normalizeNotificationListQuery({ filter: "unread", limit: "12.9" })).toEqual({ unreadOnly: true, limit: 12 });
    expect(normalizeNotificationListQuery({ limit: "0" })).toEqual({ unreadOnly: false, limit: 1 });
    expect(normalizeNotificationListQuery({ limit: "-5" })).toEqual({ unreadOnly: false, limit: 1 });
  });

  it("returns the unread count for only the token owner", async () => {
    mocks.countNotifications.mockResolvedValue(7);
    const response = await request(app, "/api/notifications/unread-count", { token: token() });
    expect(response).toEqual({ status: 200, body: { count: 7 } });
    expect(mocks.countNotifications).toHaveBeenCalledWith({ where: { userId, isRead: false } });
  });

  it("marks all unread notifications belonging to the token owner", async () => {
    mocks.updateNotifications.mockResolvedValue({ count: 3 });
    const response = await request(app, "/api/notifications/read-all", { method: "PATCH", token: token() });
    expect(response).toEqual({ status: 200, body: { count: 3 } });
    expect(mocks.updateNotifications).toHaveBeenCalledWith({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  });

  it("marks one owned unread notification as read", async () => {
    const response = await request(app, `/api/notifications/${notificationId}/read`, {
      method: "PATCH", token: token(),
    });
    expect(response.status).toBe(200);
    expect(response.body.isRead).toBe(true);
    expect(mocks.findNotification).toHaveBeenCalledWith({ where: { id: notificationId, userId } });
    expect(mocks.updateNotification).toHaveBeenCalledWith({ where: { id: notificationId }, data: { isRead: true } });
  });

  it("returns an already-read owned notification without another write", async () => {
    mocks.findNotification.mockResolvedValue({ ...notification, isRead: true });
    const response = await request(app, `/api/notifications/${notificationId}/read`, {
      method: "PATCH", token: token(),
    });
    expect(response.status).toBe(200);
    expect(response.body.isRead).toBe(true);
    expect(mocks.updateNotification).not.toHaveBeenCalled();
  });

  it("does not reveal or update another user's notification", async () => {
    mocks.findNotification.mockResolvedValue(null);
    const response = await request(app, `/api/notifications/${notificationId}/read`, {
      method: "PATCH", token: token(),
    });
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy thông báo." } });
    expect(mocks.findNotification).toHaveBeenCalledWith({ where: { id: notificationId, userId } });
    expect(mocks.updateNotification).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/notifications"],
    ["GET", "/api/notifications/unread-count"],
    ["PATCH", "/api/notifications/read-all"],
    ["PATCH", `/api/notifications/${notificationId}/read`],
  ])("requires authentication for %s %s", async (method, path) => {
    const response = await request(app, path, { method });
    expect(response.status).toBe(401);
    expect(mocks.findNotifications).not.toHaveBeenCalled();
    expect(mocks.updateNotifications).not.toHaveBeenCalled();
  });

  it("rejects an invalid notification id", async () => {
    const response = await request(app, "/api/notifications/not-a-cuid/read", {
      method: "PATCH", token: token(),
    });
    expect(response.status).toBe(422);
    expect(mocks.findNotification).not.toHaveBeenCalled();
  });

  it("rejects non-scalar list query parameters", async () => {
    const response = await request(app, "/api/notifications?filter=all&filter=unread", { token: token() });
    expect(response.status).toBe(422);
    expect(mocks.findNotifications).not.toHaveBeenCalled();
  });

  it.each([
    ["list", () => mocks.findNotifications.mockRejectedValue(new Error("database unavailable")), "GET", "/api/notifications"],
    ["count", () => mocks.countNotifications.mockRejectedValue(new Error("database unavailable")), "GET", "/api/notifications/unread-count"],
    ["read all", () => mocks.updateNotifications.mockRejectedValue(new Error("database unavailable")), "PATCH", "/api/notifications/read-all"],
    ["read one", () => mocks.findNotification.mockRejectedValue(new Error("database unavailable")), "PATCH", `/api/notifications/${notificationId}/read`],
  ])("uses the shared 500 response when %s fails", async (_name, arrange, method, path) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    arrange();
    const response = await request(app, path, { method, token: token() });
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });
});

describe("Pantry notification compatibility", () => {
  it("returns no candidates when nothing needs a notification", () => {
    expect(buildPantryNotificationCandidates([], now)).toEqual([]);
    expect(buildPantryNotificationCandidates([
      pantryItem({ expiryDate: new Date("2026-08-30T00:00:00.000Z") }),
    ], now)).toEqual([]);
  });

  it("keeps expiring notification content, action URL and stable dedupe key", () => {
    const result = buildPantryNotificationCandidates([
      pantryItem({ expiryDate: new Date("2026-08-22T00:00:00.000Z") }),
    ], now);
    expect(result).toEqual([{
      userId,
      type: "PANTRY_EXPIRING",
      title: "Thực phẩm sắp hết hạn",
      message: "Ức gà sẽ hết hạn sau 2 ngày.",
      relatedId: pantryId,
      actionUrl: `/pantry?item=${encodeURIComponent(pantryId)}`,
      dedupeKey: `pantry-expiring:${pantryId}:2026-08-22`,
    }]);
  });

  it("keeps expired and low-stock notification contracts", () => {
    const item = pantryItem({
      quantity: 1,
      minimumStock: 2,
      expiryDate: new Date("2026-08-19T00:00:00.000Z"),
    });
    const first = buildPantryNotificationCandidates([item], now);
    const second = buildPantryNotificationCandidates([item], now);
    expect(first.map(({ type, title, message, actionUrl }) => ({ type, title, message, actionUrl }))).toEqual([
      {
        type: "PANTRY_EXPIRED",
        title: "Thực phẩm đã hết hạn",
        message: "Ức gà đã hết hạn. Hãy kiểm tra trước khi sử dụng.",
        actionUrl: `/pantry?item=${encodeURIComponent(pantryId)}`,
      },
      {
        type: "PANTRY_LOW_STOCK",
        title: "Thực phẩm sắp hết",
        message: "Ức gà đã chạm mức tồn kho tối thiểu.",
        actionUrl: `/pantry?item=${encodeURIComponent(pantryId)}`,
      },
    ]);
    expect(first.map((item) => item.dedupeKey)).toEqual(second.map((item) => item.dedupeKey));
  });

  it("does not create candidates for depleted Pantry items", () => {
    expect(buildPantryNotificationCandidates([
      pantryItem({ quantity: 0, minimumStock: 2, expiryDate: new Date("2026-08-19T00:00:00.000Z") }),
    ], now)).toEqual([]);
  });

  it("syncs Pantry candidates with createMany and skipDuplicates", async () => {
    const item = pantryItem({ expiryDate: new Date("2026-08-22T00:00:00.000Z") });
    mocks.findPantryItems.mockResolvedValue([item]);
    mocks.createNotifications.mockResolvedValue({ count: 1 });
    await expect(syncPantryNotifications(userId, now)).resolves.toBe(1);
    expect(mocks.findPantryItems).toHaveBeenCalledWith({
      where: {
        userId,
        quantity: { gt: 0 },
        OR: [
          { expiryDate: { lte: new Date("2026-08-23T00:00:00.000Z") } },
          { minimumStock: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        userId: true,
        name: true,
        quantity: true,
        minimumStock: true,
        expiryDate: true,
        updatedAt: true,
      },
    });
    expect(mocks.createNotifications).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        type: "PANTRY_EXPIRING",
        dedupeKey: `pantry-expiring:${pantryId}:2026-08-22`,
      })],
      skipDuplicates: true,
    });
  });

  it("does not call createMany when sync finds no candidates", async () => {
    await expect(syncPantryNotifications(userId, now)).resolves.toBe(0);
    expect(mocks.createNotifications).not.toHaveBeenCalled();
  });

  it("keeps candidate ownership from the Pantry item", () => {
    const result = buildPantryNotificationCandidates([
      pantryItem({ userId: otherUserId, expiryDate: new Date("2026-08-22T00:00:00.000Z") }),
    ], now);
    expect(result[0].userId).toBe(otherUserId);
  });
});
