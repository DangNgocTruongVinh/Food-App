import { z } from "zod";
import { FOOD_CATEGORIES } from "../../services/food-category.js";

const empty = z.object({});
const scanParams = z.object({ id: z.string().cuid() });
const text = (max: number) => z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(z.string().min(1).max(max));

export const MAX_RECEIPT_LINES = 60;

export const receiptStatusSchema = z.object({ body: empty, params: empty, query: empty });

/** multipart: trường "image" (multer) + "provider" tùy chọn (auto | openai | tesseract); không gửi = "auto". */
export const startReceiptScanSchema = z.object({
  body: z.object({ provider: z.enum(["auto", "tesseract", "openai"]).optional() }),
  params: empty,
  query: empty,
});

export const receiptScanIdSchema = z.object({ body: empty, params: scanParams, query: empty });

/** Dòng người dùng đã duyệt (sửa/bỏ ở màn duyệt). Server kiểm lại toàn bộ, không dựa vào dòng nháp. */
export const receiptLineSchema = z.object({
  name: text(100),
  quantity: z.number().positive().max(100_000),
  unit: z.enum(["G", "KG", "ML", "L", "ITEM", "PACKAGE"]),
  category: z.enum(FOOD_CATEGORIES),
  storageLocation: z.enum(["REFRIGERATOR", "FREEZER", "DRY_STORAGE"]),
  expiryDate: z.string().date().nullable(),
  expiryEstimated: z.boolean().default(false),
  /** Thành tiền đọc được trên hóa đơn (tùy chọn) → đơn giá của thực phẩm. */
  price: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
});

export const commitReceiptScanSchema = z.object({
  body: z.object({ lines: z.array(receiptLineSchema).min(1).max(MAX_RECEIPT_LINES) }),
  params: scanParams,
  query: empty,
});

export type ReceiptLineInput = z.infer<typeof receiptLineSchema>;
export type StartReceiptScanInput = z.infer<typeof startReceiptScanSchema>["body"];
export type CommitReceiptScanInput = z.infer<typeof commitReceiptScanSchema>["body"];
export type ReceiptScanParams = z.infer<typeof scanParams>;
