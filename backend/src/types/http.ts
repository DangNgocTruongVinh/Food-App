import type { Role } from "@prisma/client";
import type { Request } from "express";

/** Request data after the route's validate(schema) middleware has succeeded. */
export type ValidatedRequest<
  TBody,
  TParams = Request["params"],
  TQuery = Request["query"],
> = Request<TParams, unknown, TBody, TQuery>;

export interface AuthenticatedRequest extends Request {
  userId: string;
  /** Quyền đọc từ DB trong requireAuth (không lấy từ JWT). */
  userRole: Role;
}

export interface TokenPayload {
  sub: string;
  email: string;
}
