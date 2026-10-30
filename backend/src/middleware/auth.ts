import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { getAccountStatus } from "../services/account-status.service.js";
import type { AuthenticatedRequest, TokenPayload } from "../types/http.js";
import { HttpError } from "../utils/http-error.js";

export const ACCOUNT_LOCKED_CODE = "ACCOUNT_LOCKED";

/** 403 kèm details.code để frontend nhận ra tài khoản bị khóa (đăng xuất và báo cho người dùng). */
export function accountLockedError() {
  return new HttpError(403, "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.", { code: ACCOUNT_LOCKED_CODE });
}

const invalidSession = () => new HttpError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");

/**
 * Xác thực JWT rồi đọc quyền và trạng thái khóa từ DB: tài khoản bị khóa bị chặn ngay ở request kế tiếp,
 * không đợi token hết hạn. GĐ4: khóa tài khoản sẽ thu hồi thêm refresh token.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new HttpError(401, "Bạn cần đăng nhập để tiếp tục."));

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return next(invalidSession());
  }

  const account = await getAccountStatus(payload.sub);
  if (!account) return next(invalidSession());
  if (account.lockedAt) return next(accountLockedError());
  (req as AuthenticatedRequest).userId = payload.sub;
  (req as AuthenticatedRequest).userRole = account.role;
  next();
}

/** Đặt sau requireAuth: chỉ tài khoản ADMIN (quyền vừa đọc từ DB) được đi tiếp. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if ((req as AuthenticatedRequest).userRole !== "ADMIN") {
    return next(new HttpError(403, "Bạn không có quyền thực hiện thao tác này."));
  }
  next();
}
