import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH, REMEMBER_TTL_MS } from "./refresh-token.service.js";

// Cookie refresh token: httpOnly (JavaScript không đọc được → XSS không lấy được), SameSite=Strict (trình duyệt không gửi kèm
// request từ trang khác → chống CSRF), chỉ gửi tới /api/auth, Secure khi production (COOKIE_SECURE ghi đè được).

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
  sameSite: "strict",
  path: REFRESH_COOKIE_PATH,
});

/** Nhớ đăng nhập → cookie 30 ngày; không nhớ → cookie phiên (mất khi đóng trình duyệt). */
export function setRefreshCookie(res: Response, token: string, remember: boolean) {
  res.cookie(REFRESH_COOKIE, token, remember ? { ...baseOptions(), maxAge: REMEMBER_TTL_MS } : baseOptions());
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}

/** Đọc cookie từ header (không cần thêm thư viện cookie-parser). */
export function readRefreshCookie(req: Request) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0 || part.slice(0, index).trim() !== REFRESH_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim()) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
