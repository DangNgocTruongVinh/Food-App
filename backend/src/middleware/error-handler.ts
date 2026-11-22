import { Prisma } from "@prisma/client";
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

/**
 * Lỗi Prisma do hai thao tác chạy đồng thời (bấm hai lần, hai thiết bị): trùng khóa duy nhất (P2002, vd. thích cùng một bài hai lần
 * cùng lúc) → 409; bản ghi cần sửa/xóa không còn (P2025, vd. xóa một bình luận vừa bị xóa) → 404. Không trả meta của Prisma (tên
 * bảng, cột, câu truy vấn). Mã Prisma khác vẫn là lỗi máy chủ (500).
 */
const prismaErrors: Record<string, { status: number; message: string }> = {
  P2002: { status: 409, message: "Dữ liệu vừa thay đổi, vui lòng tải lại rồi thử lại." },
  P2025: { status: 404, message: "Không tìm thấy dữ liệu, có thể đã bị xóa." },
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
  const prismaError = error instanceof Prisma.PrismaClientKnownRequestError ? prismaErrors[error.code] : undefined;
  if (prismaError) {
    res.status(prismaError.status).json({ message: prismaError.message });
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
