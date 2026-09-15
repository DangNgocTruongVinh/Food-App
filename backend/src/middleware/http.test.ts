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
