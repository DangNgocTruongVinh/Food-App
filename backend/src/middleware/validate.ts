import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { HttpError } from "../utils/http-error.js";

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ body: req.body ?? {}, params: req.params ?? {}, query: req.query ?? {} });
    if (!parsed.success) {
      return next(new HttpError(422, "Dữ liệu gửi lên chưa hợp lệ.", parsed.error.flatten()));
    }
    req.body = parsed.data.body;
    req.params = parsed.data.params;
    next();
  };
}
