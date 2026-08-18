import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
}
