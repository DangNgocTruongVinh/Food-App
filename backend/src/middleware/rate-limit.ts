import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";

// Giới hạn số request theo IP, cửa sổ cố định, lưu trong bộ nhớ (một tiến trình backend; nhiều tiến trình thì cần kho chung như
// Redis — ghi ở docs/test-evidence/bao-mat.md). IP lấy từ req.ip: sau proxy (nginx) phải đặt TRUST_PROXY để đọc X-Forwarded-For.

/** keyOf: đếm theo khóa khác IP (vd. email đã chuẩn hóa); mặc định theo IP. */
export function rateLimit({ windowMs, max, message, keyOf }: {
  windowMs: number; max: number; message: string; keyOf?: (req: Request) => string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    const key = keyOf ? keyOf(req) : req.ip ?? req.socket.remoteAddress ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new HttpError(429, message));
    }
    next();
  };
  /** Cho test: xóa bộ đếm. */
  middleware.reset = () => hits.clear();
  return middleware;
}
