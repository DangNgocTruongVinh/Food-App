import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountStatus } from "../../services/account-status.service.js";
import { request, testApp } from "../../test/http-test-utils.js";
import adminRoutes from "./admin.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  count: vi.fn(), findMany: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: { adminAuditLog: { count: mocks.count, findMany: mocks.findMany } } }));

const app = testApp("/api/admin", adminRoutes);
const adminId = "cm11111111111111111111111";
const recipeId = "cm22222222222222222222222";
const path = "/api/admin/audit-logs";
const token = () => `Bearer ${jwt.sign({ sub: adminId, email: "admin@nouri.vn" }, mocks.secret)}`;
const accountStatus = vi.mocked(getAccountStatus);

const row = {
  id: "cm77777777777777777777777", action: "RECIPE_HIDE", targetType: "RECIPE", targetId: recipeId, targetLabel: "Cá kho tộ",
  details: null, createdAt: new Date("2026-10-31T05:00:00.000Z"), actor: { id: adminId, name: "Quản trị viên", email: "admin@nouri.vn" },
};

beforeEach(() => {
  vi.resetAllMocks();
  accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: null });
  mocks.count.mockResolvedValue(45);
  mocks.findMany.mockResolvedValue([row]);
});

describe("GET /api/admin/audit-logs permissions", () => {
  it("401 without login, 403 for USER and for a locked admin, without reading the log", async () => {
    expect((await request(app, path)).status).toBe(401);
    accountStatus.mockResolvedValue({ role: "USER", lockedAt: null });
    expect(await request(app, path, { token: token() }))
      .toEqual({ status: 403, body: { message: "Bạn không có quyền thực hiện thao tác này." } });
    accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: new Date() });
    const locked = await request(app, path, { token: token() });
    expect(locked.status).toBe(403);
    expect(locked.body.details).toEqual({ code: "ACCOUNT_LOCKED" });
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("200 for an ADMIN", async () => {
    expect((await request(app, path, { token: token() })).status).toBe(200);
  });
});

describe("GET /api/admin/audit-logs listing", () => {
  it("lists newest first with pagination and the actor's id, name and email only", async () => {
    const response = await request(app, `${path}?page=3&pageSize=20`, { token: token() });
    expect(response.body).toEqual({ items: [{ ...row, createdAt: row.createdAt.toISOString() }], total: 45, page: 3, pageSize: 20 });
    const query = mocks.findMany.mock.calls[0][0];
    expect(query).toMatchObject({ where: {}, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 40, take: 20 });
    expect(query.select.actor).toEqual({ select: { id: true, name: true, email: true } });
  });

  it("uses page 1 / 20 per page by default", async () => {
    await request(app, path, { token: token() });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
  });

  it("filters by action, target and actor", async () => {
    await request(app, `${path}?action=RECIPE_HIDE&targetType=RECIPE&targetId=${recipeId}&actorId=${adminId}`, { token: token() });
    const where = { action: "RECIPE_HIDE", targetType: "RECIPE", targetId: recipeId, actorId: adminId };
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it.each([
    ["a page size over 50", "pageSize=51"],
    ["page 0", "page=0"],
    ["an unknown action", "action=LOGIN"],
    ["an unknown target type", "targetType=PASSWORD"],
    ["a target id that is not a cuid", "targetId=1%20OR%201%3D1"],
  ])("rejects %s with 422", async (_name, query) => {
    expect((await request(app, `${path}?${query}`, { token: token() })).status).toBe(422);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
