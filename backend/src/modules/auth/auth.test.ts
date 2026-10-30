import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import authRoutes from "./auth.routes.js";
import { request, testApp } from "../../test/http-test-utils.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findUser: vi.fn(), createUser: vi.fn(),
}));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  user: { findUnique: mocks.findUser, create: mocks.createUser },
} }));

const app = testApp("/api/auth", authRoutes);
const user = { id: "user-a", name: "Minh Anh", email: "demo@nouri.vn", passwordHash: "private-hash", role: "USER", lockedAt: null };
const credentials = { email: "Demo@Nouri.vn", password: "Demo@123" };
beforeEach(() => vi.resetAllMocks());

describe("Auth HTTP contract (no database)", () => {
  it("registers with the same normalization, hash cost, default profile and public response", async () => {
    mocks.findUser.mockResolvedValue(null);
    mocks.createUser.mockImplementation(async ({ data }) => ({ ...user, ...data }));
    const response = await request(app, "/api/auth/register", {
      method: "POST", body: { ...credentials, name: "  Minh Anh  ", admin: true, role: "ADMIN" },
    });
    expect(response.status).toBe(201);
    // Không đăng ký được thành Admin: role gửi lên bị bỏ, tài khoản nhận quyền mặc định USER.
    expect(response.body.user).toEqual({ id: user.id, name: user.name, email: user.email, role: "USER" });
    const data = mocks.createUser.mock.calls[0][0].data;
    expect(data).toEqual({ email: user.email, name: user.name, passwordHash: expect.any(String), profile: { create: {} } });
    expect(bcrypt.getRounds(data.passwordHash)).toBe(12);
    expect(await bcrypt.compare(credentials.password, data.passwordHash)).toBe(true);
    const token = jwt.verify(response.body.token, mocks.secret) as jwt.JwtPayload;
    expect(token).toMatchObject({ sub: user.id, email: user.email });
    expect(token.exp! - token.iat!).toBe(7 * 24 * 60 * 60);
    expect(Object.keys(response.body).sort()).toEqual(["token", "user"]);
  });

  it("returns the existing 409 error for a duplicate email", async () => {
    mocks.findUser.mockResolvedValue(user);
    expect(await request(app, "/api/auth/register", { method: "POST", body: { ...credentials, name: user.name } }))
      .toEqual({ status: 409, body: { message: "Email này đã được sử dụng." } });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it.each([
    ["/register", { ...credentials, name: "A" }],
    ["/login", { ...credentials, email: "not-email" }],
    ["/login", { ...credentials, password: "short" }],
    ["/login", { ...credentials, password: "a".repeat(73) }],
    ["/login", { ...credentials, email: " demo@nouri.vn " }],
  ])("rejects invalid input before calling Prisma: %s %j", async (path, body) => {
    const response = await request(app, `/api/auth${path}`, { method: "POST", body });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(response.body.details).toEqual({ formErrors: [], fieldErrors: { body: expect.any(Array) } });
    expect(mocks.findUser).not.toHaveBeenCalled();
  });

  it("logs in and never exposes the password hash", async () => {
    mocks.findUser.mockResolvedValue({ ...user, passwordHash: await bcrypt.hash(credentials.password, 4) });
    const response = await request(app, "/api/auth/login", { method: "POST", body: credentials });
    expect(response.status).toBe(200);
    expect(mocks.findUser).toHaveBeenCalledWith({ where: { email: user.email } });
    expect(response.body.user).toEqual({ id: user.id, email: user.email, name: user.name, role: "USER" });
    expect(jwt.verify(response.body.token, mocks.secret)).toMatchObject({ sub: user.id });
  });

  it("returns the role so the frontend can show Admin pages", async () => {
    mocks.findUser.mockResolvedValue({ ...user, role: "ADMIN", passwordHash: await bcrypt.hash(credentials.password, 4) });
    const response = await request(app, "/api/auth/login", { method: "POST", body: credentials });
    expect(response.body.user.role).toBe("ADMIN");
    expect(jwt.decode(response.body.token)).not.toHaveProperty("role");
  });

  it("blocks a locked account with the right password and a clear 403", async () => {
    mocks.findUser.mockResolvedValue({ ...user, lockedAt: new Date(), passwordHash: await bcrypt.hash(credentials.password, 4) });
    expect(await request(app, "/api/auth/login", { method: "POST", body: credentials })).toEqual({
      status: 403,
      body: { message: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.", details: { code: "ACCOUNT_LOCKED" } },
    });
  });

  it("does not reveal that an account is locked to someone with a wrong password", async () => {
    mocks.findUser.mockResolvedValue({ ...user, lockedAt: new Date(), passwordHash: await bcrypt.hash("different", 4) });
    expect(await request(app, "/api/auth/login", { method: "POST", body: credentials }))
      .toEqual({ status: 401, body: { message: "Email hoặc mật khẩu không đúng." } });
  });

  it.each([false, true])("uses the same 401 response for missing user / wrong password (%s)", async (exists) => {
    mocks.findUser.mockResolvedValue(exists ? { ...user, passwordHash: await bcrypt.hash("different", 4) } : null);
    expect(await request(app, "/api/auth/login", { method: "POST", body: credentials }))
      .toEqual({ status: 401, body: { message: "Email hoặc mật khẩu không đúng." } });
  });
});
