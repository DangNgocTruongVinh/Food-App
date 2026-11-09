import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requestWithCookies, testApp } from "../../test/http-test-utils.js";
import authRoutes, { credentialsLimit } from "./auth.routes.js";
import { hashRefreshToken, REFRESH_COOKIE, REMEMBER_TTL_MS, REUSE_GRACE_MS } from "./refresh-token.service.js";

// Refresh token (GĐ4) với bảng RefreshToken giả trong bộ nhớ: xoay vòng, dùng lại token cũ, đăng xuất, khóa, đổi mật khẩu.

type Row = {
  id: string; userId: string; tokenHash: string; familyId: string; remember: boolean;
  expiresAt: Date; usedAt: Date | null; revokedAt: Date | null; createdAt: Date;
};
type UserRow = { id: string; email: string; name: string; role: "USER" | "ADMIN"; lockedAt: Date | null; passwordHash: string; passwordChangedAt: Date | null };

const db = vi.hoisted(() => ({ rows: [] as Row[], users: [] as UserRow[], secret: "nouri-test-only-secret-at-least-32-characters" }));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: db.secret, NODE_ENV: "production" } }));
vi.mock("../../lib/prisma.js", () => {
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "lt" in value) return (row[key] as Date) < (value as { lt: Date }).lt;
    return row[key] === value;
  });
  const userView = (user: UserRow | undefined) => user && { id: user.id, email: user.email, name: user.name, role: user.role, lockedAt: user.lockedAt };
  const client = {
    user: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
        db.users.find((user) => (where.id ? user.id === where.id : user.email === where.email)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
        const user = db.users.find((candidate) => candidate.id === where.id)!;
        Object.assign(user, data);
        return user;
      },
    },
    refreshToken: {
      create: async ({ data }: { data: Omit<Row, "id" | "usedAt" | "revokedAt" | "createdAt"> }) => {
        const row = { ...data, id: `rt-${db.rows.length + 1}`, usedAt: null, revokedAt: null, createdAt: new Date() };
        db.rows.push(row);
        return row;
      },
      findUnique: async ({ where, include }: { where: { tokenHash: string }; include?: unknown }) => {
        const row = db.rows.find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!row) return null;
        return include ? { ...row, user: userView(db.users.find((user) => user.id === row.userId)) } : { ...row };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const hit = db.rows.filter((row) => matches(row, where));
        hit.forEach((row) => Object.assign(row, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = db.rows.length;
        db.rows = db.rows.filter((row) => !matches(row, where));
        return { count: before - db.rows.length };
      },
    },
    $transaction: async (operation: (tx: unknown) => unknown) => operation(client),
  };
  return { prisma: client };
});
vi.mock("../../services/account-status.service.js", () => ({
  getAccountStatus: async (id: string) => {
    const user = db.users.find((candidate) => candidate.id === id);
    return user ? { role: user.role, lockedAt: user.lockedAt, passwordChangedAt: user.passwordChangedAt } : null;
  },
}));

const app = testApp("/api/auth", authRoutes);
const password = "Demo@123";
let passwordHash = "";
beforeAll(async () => { passwordHash = await bcrypt.hash(password, 4); });
beforeEach(() => {
  credentialsLimit.reset();
  db.rows = [];
  db.users = [{ id: "user-a", email: "demo@nouri.vn", name: "Minh Anh", role: "USER", lockedAt: null, passwordHash, passwordChangedAt: null }];
});

/** Giá trị token trong Set-Cookie của refresh token (undefined nếu không có). */
const cookieOf = (setCookie: string[]) => setCookie.find((line) => line.startsWith(`${REFRESH_COOKIE}=`));
const tokenOf = (setCookie: string[]) => decodeURIComponent(cookieOf(setCookie)!.split(";")[0].slice(REFRESH_COOKIE.length + 1));
const asCookie = (token: string) => `${REFRESH_COOKIE}=${encodeURIComponent(token)}`;

async function login(remember = true) {
  const response = await requestWithCookies(app, "/api/auth/login", { method: "POST", body: { email: "demo@nouri.vn", password, remember } });
  expect(response.status).toBe(200);
  return { ...response, refresh: tokenOf(response.setCookie) };
}
const refresh = (token: string) => requestWithCookies(app, "/api/auth/refresh", { method: "POST", body: {}, cookie: asCookie(token) });

describe("Refresh token cookie (GĐ4)", () => {
  it("logs in with a 15-minute access token and an httpOnly, Secure, SameSite=Strict cookie limited to /api/auth", async () => {
    const { body, setCookie, refresh: token } = await login(true);
    const payload = jwt.verify(body.token, db.secret) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(15 * 60);
    expect(body).not.toHaveProperty("refreshToken");
    const cookie = cookieOf(setCookie)!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(new RegExp(`Max-Age=${REMEMBER_TTL_MS / 1000}`));
    // DB chỉ có bản băm, không có token gốc.
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].tokenHash).toBe(hashRefreshToken(token));
    expect(JSON.stringify(db.rows)).not.toContain(token);
  });

  it("uses a session cookie (no Max-Age/Expires) when \"Nhớ đăng nhập\" is not ticked", async () => {
    const cookie = cookieOf((await login(false)).setCookie)!;
    expect(cookie).not.toMatch(/Max-Age|Expires/);
    expect(db.rows[0].remember).toBe(false);
  });

  it("rotates: a refresh returns a new access token and a new refresh token in the same family; the old one is marked used", async () => {
    const first = await login();
    const response = await refresh(first.refresh);
    expect(response.status).toBe(200);
    expect(jwt.verify(response.body.token, db.secret)).toMatchObject({ sub: "user-a" });
    expect(response.body.user).toEqual({ id: "user-a", email: "demo@nouri.vn", name: "Minh Anh", role: "USER" });
    const next = tokenOf(response.setCookie);
    expect(next).not.toBe(first.refresh);
    expect(db.rows).toHaveLength(2);
    expect(db.rows[0].usedAt).toBeInstanceOf(Date);
    expect(db.rows[1]).toMatchObject({ familyId: db.rows[0].familyId, usedAt: null, revokedAt: null, remember: true });
    expect((await refresh(next)).status).toBe(200);
  });

  it("reusing an old (rotated) token revokes the whole family: the thief and the real user both have to log in again", async () => {
    const first = await login();
    const next = tokenOf((await refresh(first.refresh)).setCookie);
    db.rows[0].usedAt = new Date(Date.now() - REUSE_GRACE_MS - 1000);
    const reuse = await refresh(first.refresh);
    expect(reuse.status).toBe(401);
    expect(cookieOf(reuse.setCookie)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(db.rows.every((row) => row.revokedAt)).toBe(true);
    expect((await refresh(next)).status).toBe(401);
  });

  it("two tabs refreshing at the same moment: the second gets 401 REFRESH_RACE, nothing is revoked and its cookie is kept", async () => {
    const first = await login();
    await refresh(first.refresh);
    const race = await refresh(first.refresh);
    expect(race.status).toBe(401);
    expect(race.body.details).toEqual({ code: "REFRESH_RACE" });
    expect(cookieOf(race.setCookie)).toBeUndefined();
    expect(db.rows.some((row) => row.revokedAt)).toBe(false);
  });

  it("rejects a missing, unknown or expired token with 401", async () => {
    expect((await requestWithCookies(app, "/api/auth/refresh", { method: "POST", body: {} })).status).toBe(401);
    expect((await refresh("not-a-real-token")).status).toBe(401);
    const { refresh: token } = await login();
    db.rows[0].expiresAt = new Date(Date.now() - 1000);
    expect((await refresh(token)).status).toBe(401);
  });

  it("logout revokes the family and clears the cookie; the token no longer refreshes", async () => {
    const { refresh: token } = await login();
    const response = await requestWithCookies(app, "/api/auth/logout", { method: "POST", body: {}, cookie: asCookie(token) });
    expect(response.status).toBe(204);
    expect(cookieOf(response.setCookie)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(db.rows[0].revokedAt).toBeInstanceOf(Date);
    expect((await refresh(token)).status).toBe(401);
    // Đăng xuất không có cookie vẫn trả 204.
    expect((await requestWithCookies(app, "/api/auth/logout", { method: "POST", body: {} })).status).toBe(204);
  });

  it("a locked account cannot refresh: 403 ACCOUNT_LOCKED and every refresh token of the user is revoked", async () => {
    const { refresh: token } = await login();
    await login(false);
    db.users[0].lockedAt = new Date();
    const response = await refresh(token);
    expect(response).toMatchObject({ status: 403, body: { details: { code: "ACCOUNT_LOCKED" } } });
    expect(db.rows.every((row) => row.revokedAt)).toBe(true);
  });

  it("changing the password revokes every other session, rejects old access tokens and keeps this device signed in", async () => {
    const other = await login();
    const current = await login(false);
    const wrong = await requestWithCookies(app, "/api/auth/change-password", {
      method: "POST", token: `Bearer ${current.body.token}`, cookie: asCookie(current.refresh), body: { currentPassword: "Sai@12345", newPassword: "Moi@123456" },
    });
    expect(wrong).toMatchObject({ status: 400, body: { message: "Mật khẩu hiện tại không đúng." } });

    // Token cũ phát trước lần đổi (lùi iat 1 phút để không trùng giây với lần đổi).
    const oldAccess = jwt.sign({ sub: "user-a", email: "demo@nouri.vn", iat: Math.floor(Date.now() / 1000) - 60 }, db.secret);
    const changed = await requestWithCookies(app, "/api/auth/change-password", {
      method: "POST", token: `Bearer ${oldAccess}`, cookie: asCookie(current.refresh), body: { currentPassword: password, newPassword: "Moi@123456" },
    });
    expect(changed.status).toBe(200);
    expect(await bcrypt.compare("Moi@123456", db.users[0].passwordHash)).toBe(true);
    expect(db.users[0].passwordChangedAt).toBeInstanceOf(Date);
    // Cả hai phiên cũ bị thu hồi; thiết bị này nhận phiên mới, giữ kiểu cookie phiên (không nhớ đăng nhập).
    expect((await refresh(other.refresh)).status).toBe(401);
    expect(cookieOf(changed.setCookie)).not.toMatch(/Max-Age/);
    expect((await refresh(tokenOf(changed.setCookie))).status).toBe(200);
    // Access token phát trước lần đổi bị từ chối ngay.
    const again = await requestWithCookies(app, "/api/auth/change-password", {
      method: "POST", token: `Bearer ${oldAccess}`, body: { currentPassword: "Moi@123456", newPassword: "Khac@123456" },
    });
    expect(again.status).toBe(401);
  });
});

describe("Login/register rate limit and request body errors (GĐ4)", () => {
  it("allows 20 login/register attempts per minute per IP, then answers 429 with Retry-After", async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await requestWithCookies(app, "/api/auth/login", { method: "POST", body: { email: "demo@nouri.vn", password: "Sai@12345" } });
      expect(response.status).toBe(401);
    }
    const blocked = await requestWithCookies(app, "/api/auth/register", { method: "POST", body: { email: "x@nouri.vn", password, name: "Xuân" } });
    expect(blocked).toMatchObject({ status: 429, body: { message: "Bạn thử quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại." } });
    // Làm mới phiên không bị giới hạn chung với đăng nhập.
    expect((await requestWithCookies(app, "/api/auth/refresh", { method: "POST", body: {} })).status).toBe(401);
  });

  it("answers broken JSON with 400 and an oversized body with 413, without internal details", async () => {
    const broken = await requestWithCookies(app, "/api/auth/login", { method: "POST", rawBody: "{\"email\":" });
    expect(broken).toMatchObject({ status: 400, body: { message: "Dữ liệu gửi lên không phải JSON hợp lệ." } });
    const huge = await requestWithCookies(app, "/api/auth/login", { method: "POST", body: { email: "demo@nouri.vn", password, pad: "x".repeat(110_000) } });
    expect(huge).toEqual({ status: 413, body: { message: "Dữ liệu gửi lên quá lớn." }, setCookie: [] });
  });
});
