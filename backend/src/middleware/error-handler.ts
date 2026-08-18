import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Không tìm thấy ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, details: error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(422).json({ message: "Dữ liệu chưa hợp lệ.", details: error.flatten() });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." });
};
