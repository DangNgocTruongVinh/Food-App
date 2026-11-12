import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import authRoutes, { credentialsLimit, forgotEmailLimit, forgotIpLimit } from "./auth.routes.js";
import { FORGOT_PASSWORD_MESSAGE, hashResetToken } from "./password-reset.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findUser: vi.fn(), updateUser: vi.fn(), deleteResets: vi.fn(), createReset: vi.fn(), findReset: vi.fn(), claimReset: vi.fn(),
  deleteRefresh: vi.fn(), revokeRefresh: vi.fn(), transaction: vi.fn(), sendMail: vi.fn(),
}));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret, FRONTEND_URL: "http://localhost:8080/" } }));
const client = () => ({
  user: { findUnique: mocks.findUser, update: mocks.updateUser },
  passwordResetToken: { deleteMany: mocks.deleteResets, create: mocks.createReset, findUnique: mocks.findReset, updateMany: mocks.claimReset },
  refreshToken: { deleteMany: mocks.deleteRefresh, updateMany: mocks.revokeRefresh },
});
vi.mock("../../lib/prisma.js", () => ({ prisma: new Proxy({}, {
  get: (_target, key) => (key === "$transaction" ? mocks.transaction : Reflect.get(client(), key)),
}) }));
// Transport giả: không gửi email thật, chỉ ghi lại thư đã "gửi".
vi.mock("../../services/email.service.js", () => ({ sendMailInBackground: mocks.sendMail, isEmailConfigured: () => false }));

const app = testApp("/api/auth", authRoutes);
const tx = fakeTransaction(client);
const user = { id: "user-a", name: "Minh <Anh>", email: "demo@nouri.vn", lockedAt: null };
const token = "A".repeat(43);
const now = Date.now();
const record = (extra = {}) => ({ id: "reset-1", usedAt: null, expiresAt: new Date(now + 10 * 60_000), user, ...extra });
const forgot = (email = "Demo@Nouri.vn") => request(app, "/api/auth/forgot-password", { method: "POST", body: { email } });
const reset = (body: object = { token, password: "MatKhauMoi1" }) => request(app, "/api/auth/reset-password", { method: "POST", body });

beforeEach(() => {
  vi.resetAllMocks();
  credentialsLimit.reset();
  forgotIpLimit.reset();
  forgotEmailLimit.reset();
  mocks.transaction.mockImplementation(tx.run);
  mocks.findUser.mockResolvedValue(user);
  mocks.deleteResets.mockResolvedValue({ count: 1 });
  mocks.createReset.mockResolvedValue({});
  mocks.findReset.mockResolvedValue(record());
  mocks.claimReset.mockResolvedValue({ count: 1 });
  mocks.updateUser.mockResolvedValue({});
  mocks.deleteRefresh.mockResolvedValue({ count: 0 });
  mocks.revokeRefresh.mockResolvedValue({ count: 2 });
});

describe("POST /forgot-password", () => {
  it("tạo token 30 phút (DB chỉ lưu bản băm), xóa token cũ trong cùng transaction, gửi liên kết qua email", async () => {
    const response = await forgot();
    expect(response).toEqual({ status: 200, body: { message: FORGOT_PASSWORD_MESSAGE } });
    expect(mocks.findUser.mock.calls[0][0].where).toEqual({ email: "demo@nouri.vn" });
    expect(mocks.deleteResets).toHaveBeenCalledWith({ where: { userId: user.id } });
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createReset)).toBe(true);
    const data = mocks.createReset.mock.calls[0][0].data;
    const mail = mocks.sendMail.mock.calls[0][0];
    const sent = /reset-password\?token=([A-Za-z0-9_-]{43})/.exec(mail.text)?.[1];
    expect(sent).toBeDefined();
    expect(data.tokenHash).toBe(hashResetToken(sent!));
    expect(data.tokenHash).not.toContain(sent!);
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
    expect(data.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30 * 60_000);
    expect(mail).toMatchObject({ to: user.email, subject: "Đặt lại mật khẩu Nouri" });
    expect(mail.text).toContain("http://localhost:8080/reset-password?token=");
    expect(mail.html).toContain("Minh &lt;Anh&gt;"); // tên người dùng được escape trong HTML
  });

  it.each([
    ["email không có tài khoản", null],
    ["tài khoản bị khóa", { ...user, lockedAt: new Date() }],
  ])("%s → cùng một câu trả lời, không tạo token, không gửi email", async (_label, found) => {
    mocks.findUser.mockResolvedValue(found);
    expect(await forgot()).toEqual({ status: 200, body: { message: FORGOT_PASSWORD_MESSAGE } });
    expect(mocks.createReset).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("rate limit: 5 yêu cầu/giờ cho mỗi email (không phân biệt hoa thường)", async () => {
    for (let index = 0; index < 5; index += 1) expect((await forgot(index % 2 ? "DEMO@nouri.vn" : "demo@nouri.vn")).status).toBe(200);
    forgotIpLimit.reset(); // tách riêng giới hạn theo email khỏi giới hạn theo IP
    const blocked = await forgot();
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain("quá nhiều lần");
    expect((await forgot("khac@nouri.vn")).status).toBe(200);
  });

  it("rate limit: 5 yêu cầu/giờ cho mỗi IP, dù đổi email", async () => {
    for (let index = 0; index < 5; index += 1) expect((await forgot(`u${index}@nouri.vn`)).status).toBe(200);
    expect((await forgot("u9@nouri.vn")).status).toBe(429);
  });
});

describe("POST /reset-password", () => {
  it("đổi mật khẩu (bcrypt 12), đánh dấu token đã dùng, thu hồi mọi refresh token trong cùng transaction, gửi email báo đổi", async () => {
    const response = await reset();
    expect(response.status).toBe(200);
    expect(mocks.findReset.mock.calls[0][0].where).toEqual({ tokenHash: hashResetToken(token) });
    expect(mocks.claimReset).toHaveBeenCalledWith({ where: { id: "reset-1", usedAt: null }, data: { usedAt: expect.any(Date) } });
    const data = mocks.updateUser.mock.calls[0][0].data;
    expect(bcrypt.getRounds(data.passwordHash)).toBe(12);
    expect(await bcrypt.compare("MatKhauMoi1", data.passwordHash)).toBe(true);
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
    expect(mocks.revokeRefresh).toHaveBeenCalledWith({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.revokeRefresh)).toBe(true);
    expect(mocks.sendMail.mock.calls[0][0]).toMatchObject({ to: user.email, subject: "Mật khẩu Nouri vừa được đổi" });
  });

  it.each([
    ["token sai", null],
    ["token đã dùng", record({ usedAt: new Date() })],
    ["token hết hạn", record({ expiresAt: new Date(now - 1) })],
  ])("%s → 400, mật khẩu không đổi", async (_label, found) => {
    mocks.findReset.mockResolvedValue(found);
    const response = await reset();
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("không hợp lệ hoặc đã hết hạn");
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.revokeRefresh).not.toHaveBeenCalled();
  });

  it("hai lần dùng cùng lúc: lần sau không giành được token → 400, không đổi mật khẩu", async () => {
    mocks.claimReset.mockResolvedValue({ count: 0 });
    expect((await reset()).status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("tài khoản bị khóa → 403, không đặt lại được", async () => {
    mocks.findReset.mockResolvedValue(record({ user: { ...user, lockedAt: new Date() } }));
    const response = await reset();
    expect(response.status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["mật khẩu quá ngắn", { token, password: "ngan" }],
    ["mật khẩu quá dài", { token, password: "a".repeat(73) }],
    ["token sai dạng", { token: "abc", password: "MatKhauMoi1" }],
  ])("%s → 422 trước khi đọc DB", async (_label, body) => {
    expect((await reset(body)).status).toBe(422);
    expect(mocks.findReset).not.toHaveBeenCalled();
  });
});
