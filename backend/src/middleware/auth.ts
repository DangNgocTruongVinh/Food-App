import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthenticatedRequest, TokenPayload } from "../types/http.js";
import { HttpError } from "../utils/http-error.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new HttpError(401, "Bạn cần đăng nhập để tiếp tục."));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."));
  }
}
