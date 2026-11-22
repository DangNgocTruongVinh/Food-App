import { Prisma } from "@prisma/client";
import express from "express";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { requireAuth } from "./auth.js";
import { request, testApp } from "../test/http-test-utils.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";
import type { AuthenticatedRequest } from "../types/http.js";

const secret = vi.hoisted(() => "nouri-test-only-secret-at-least-32-characters");
vi.mock("../config/env.js", () => ({ env: { JWT_SECRET: secret } }));
const router = express.Router();
router.get("/private", requireAuth, (req, res) => res.json({ userId: (req as AuthenticatedRequest).userId }));
router.get("/expected", asyncHandler(async () => { throw new HttpError(409, "Conflict", { field: "email" }); }));
router.get("/unexpected", asyncHandler(async () => { throw new Error("private database details"); }));
router.get("/zod", asyncHandler(async () => { z.object({ name: z.string() }).parse({}); }));
// Lỗi Prisma kèm meta như thật (tên bảng/cột): phản hồi không được lộ những chi tiết này.
const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError(
  `Invalid \`prisma.communityLike.create()\` invocation: Unique constraint failed on the fields: (\`postId\`,\`userId\`)`,
  { code, clientVersion: "test", meta: { modelName: "CommunityLike", target: ["postId", "userId"] } },
);
router.get("/prisma/:code", asyncHandler(async (req) => { throw prismaError(String(req.params.code)); }));
const app = testApp("/api", router);

describe("Shared HTTP/auth behavior", () => {
  it.each(["Bearer invalid", `Bearer ${jwt.sign({ sub: "user-a" }, secret, { expiresIn: -1 })}`, `Bearer ${jwt.sign({ sub: "user-a" }, "wrong-secret")}`])("rejects invalid/expired tokens", async (token) => {
    expect(await request(app, "/api/private", { token })).toEqual({ status: 401, body: { message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." } });
  });
  it("retains case-insensitive Bearer handling", async () => {
    const token = `bEaReR ${jwt.sign({ sub: "user-a" }, secret)}`;
    expect(await request(app, "/api/private", { token })).toEqual({ status: 200, body: { userId: "user-a" } });
  });
  it("preserves HttpError details", async () => {
    expect(await request(app, "/api/expected")).toEqual({ status: 409, body: { message: "Conflict", details: { field: "email" } } });
  });
  it("does not expose unexpected error details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await request(app, "/api/unexpected")).toEqual({ status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." } });
      expect(log).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); }
  });
  it("preserves the direct ZodError response", async () => {
    const response = await request(app, "/api/zod");
    expect(response).toEqual({ status: 422, body: { message: "Dữ liệu chưa hợp lệ.", details: { formErrors: [], fieldErrors: { name: ["Required"] } } } });
  });
  it("preserves the 404 route message", async () => {
    expect(await request(app, "/api/missing")).toEqual({ status: 404, body: { message: "Không tìm thấy GET /api/missing." } });
  });
});

// Audit R4: lỗi Prisma do thao tác đồng thời trả 409/404 thay vì 500; không lộ chi tiết nội bộ.
describe("Lỗi Prisma trong error handler chung (audit R4)", () => {
  const leaks = (body: unknown) => /communityLike|CommunityLike|postId|userId|Unique constraint|prisma|P20\d\d/.test(JSON.stringify(body));

  it("P2002 (trùng khóa duy nhất) → 409, chỉ có message tiếng Việt, không log như lỗi máy chủ", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request(app, "/api/prisma/P2002");
      expect(response).toEqual({ status: 409, body: { message: "Dữ liệu vừa thay đổi, vui lòng tải lại rồi thử lại." } });
      expect(leaks(response.body)).toBe(false);
      expect(log).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it("P2025 (bản ghi không còn) → 404, không lộ chi tiết", async () => {
    const response = await request(app, "/api/prisma/P2025");
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy dữ liệu, có thể đã bị xóa." } });
    expect(leaks(response.body)).toBe(false);
  });

  it.each(["P2003", "P2034", "P1001"])("mã Prisma khác (%s) giữ nguyên hành vi: 500, thông báo chung, có log phía server", async (code) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await request(app, `/api/prisma/${code}`);
      expect(response).toEqual({ status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." } });
      expect(leaks(response.body)).toBe(false);
      expect(log).toHaveBeenCalledOnce();
    } finally { log.mockRestore(); }
  });
});
