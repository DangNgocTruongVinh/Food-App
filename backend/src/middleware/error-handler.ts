import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Không tìm thấy ${req.method} ${req.path}.`));
};

/** Lỗi của express.json (body-parser): JSON hỏng, body quá giới hạn. */
const bodyParserErrors: Record<string, { status: number; message: string }> = {
  "entity.parse.failed": { status: 400, message: "Dữ liệu gửi lên không phải JSON hợp lệ." },
  "entity.too.large": { status: 413, message: "Dữ liệu gửi lên quá lớn." },
};

/** Không bao giờ trả stack trace hay nội dung lỗi nội bộ cho client; chi tiết chỉ ghi log phía server. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, details: error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(422).json({ message: "Dữ liệu chưa hợp lệ.", details: error.flatten() });
    return;
  }
  const bodyError = typeof error?.type === "string" ? bodyParserErrors[error.type] : undefined;
  if (bodyError) {
    res.status(bodyError.status).json({ message: bodyError.message });
    return;
  }
  console.error(error);
  res.status(500).json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." });
};
