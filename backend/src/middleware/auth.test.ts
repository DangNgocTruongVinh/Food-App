import { Router } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pantryRoutes from "../modules/pantry/pantry.routes.js";
import { getAccountStatus } from "../services/account-status.service.js";
import { request, testApp } from "../test/http-test-utils.js";
import { requireAdmin, requireAuth } from "./auth.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findUser: vi.fn(),
  listPantry: vi.fn(),
}));

vi.mock("../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../lib/prisma.js", () => ({ prisma: {
  user: { findUnique: mocks.findUser },
  pantryItem: { findMany: mocks.listPantry },
} }));

const userId = "cm11111111111111111111111";
const token = (claims: Record<string, unknown> = {}) => `Bearer ${jwt.sign({ sub: userId, email: "a@nouri.vn", ...claims }, mocks.secret)}`;
const accountStatus = vi.mocked(getAccountStatus);

const router = Router();
router.get("/me", requireAuth, (req, res) => {
  const { userId: id, userRole } = req as typeof req & { userId: string; userRole: string };
  res.json({ id, userRole });
});
router.get("/admin-only", requireAuth, requireAdmin, (_req, res) => { res.json({ ok: true }); });
const app = testApp("/api/test", router);
const pantryApp = testApp("/api/pantry", pantryRoutes);

const lockedResponse = {
  status: 403,
  body: { message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.", details: { code: "ACCOUNT_LOCKED" } },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listPantry.mockResolvedValue([]);
});

describe("requireAuth reads role and lock state from the database on every request", () => {
  it("lets an active user through with the role from the database", async () => {
    expect(await request(app, "/api/test/me", { token: token() })).toEqual({ status: 200, body: { id: userId, userRole: "USER" } });
    expect(accountStatus).toHaveBeenCalledWith(userId);
  });

  it.each([
    ["no token", undefined, "Bạn cần đăng nhập để tiếp tục."],
    ["a token signed with another secret", `Bearer ${jwt.sign({ sub: userId }, "another-secret-another-secret-123456")}`, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."],
  ])("rejects %s with 401 before reading the account", async (_name, header, message) => {
    expect(await request(app, "/api/test/me", { token: header })).toEqual({ status: 401, body: { message } });
    expect(accountStatus).not.toHaveBeenCalled();
  });

  it("rejects a valid token whose account no longer exists", async () => {
    accountStatus.mockResolvedValue(null);
    expect(await request(app, "/api/test/me", { token: token() }))
      .toEqual({ status: 401, body: { message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." } });
  });

  it("blocks a locked account immediately even with a still-valid token", async () => {
    accountStatus.mockResolvedValue({ role: "USER", lockedAt: new Date() });
    expect(await request(app, "/api/test/me", { token: token() })).toEqual(lockedResponse);
  });

  it("blocks a locked account on regular APIs too (Pantry) without touching its data", async () => {
    accountStatus.mockResolvedValue({ role: "USER", lockedAt: new Date() });
    expect(await request(pantryApp, "/api/pantry", { token: token() })).toEqual(lockedResponse);
    expect(mocks.listPantry).not.toHaveBeenCalled();
  });

  it("passes database errors to the shared 500 handler", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    accountStatus.mockRejectedValue(new Error("database unavailable"));
    expect((await request(app, "/api/test/me", { token: token() })).status).toBe(500);
  });
});

describe("requireAdmin", () => {
  it("allows an ADMIN account", async () => {
    accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: null });
    expect(await request(app, "/api/test/admin-only", { token: token() })).toEqual({ status: 200, body: { ok: true } });
  });

  it("rejects a USER account with 403", async () => {
    expect(await request(app, "/api/test/admin-only", { token: token() }))
      .toEqual({ status: 403, body: { message: "Bạn không có quyền thực hiện thao tác này." } });
  });

  it("ignores a role claim inside the token and trusts only the database", async () => {
    expect((await request(app, "/api/test/admin-only", { token: token({ role: "ADMIN" }) })).status).toBe(403);
  });

  it("requires authentication first (401) and blocks a locked admin (403)", async () => {
    expect((await request(app, "/api/test/admin-only")).status).toBe(401);
    accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: new Date() });
    expect(await request(app, "/api/test/admin-only", { token: token() })).toEqual(lockedResponse);
  });
});

describe("getAccountStatus", () => {
  it("reads only role and lock state by primary key", async () => {
    const actual = await vi.importActual<typeof import("../services/account-status.service.js")>("../services/account-status.service.js");
    mocks.findUser.mockResolvedValue({ role: "USER", lockedAt: null });
    await expect(actual.getAccountStatus(userId)).resolves.toEqual({ role: "USER", lockedAt: null });
    expect(mocks.findUser).toHaveBeenCalledWith({ where: { id: userId }, select: { role: true, lockedAt: true } });
  });
});
