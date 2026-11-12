import type { FoodUnit } from "@prisma/client";

// Kiểu dùng chung cho quét hóa đơn (GĐ3c): mọi nhà cung cấp OCR trả về một trong hai dạng OcrOutput, sau đó đi qua
// cùng bộ phân tích dòng (receipt-parser.ts) và bộ chuẩn hóa (receipt-normalize.ts).

export type ReceiptProviderId = "tesseract" | "openai" | "mock";

/** Một dòng chữ đọc được; `confidence` 0–100 (Tesseract), null khi nhà cung cấp không cho biết. */
export type OcrLine = { text: string; confidence: number | null };

/** Một dòng hàng đọc được trên hóa đơn/nhãn, chưa ghép với kho. `price` là thành tiền của dòng (chỉ để kiểm tra, không lưu). */
export type RawReceiptItem = {
  rawText: string;
  name: string;
  quantity: number | null;
  unit: FoodUnit | null;
  unitPrice: number | null;
  price: number | null;
  /** yyyy-MM-dd, đọc được từ "HSD"/"EXP" trên nhãn. */
  expiryDate: string | null;
  confidence: number | null;
  /** true: SL × đơn giá = thành tiền; false: lệch; null: không đủ số để kiểm. */
  consistent: boolean | null;
};

export type ReceiptSkipReason = "HEADER" | "TOTAL" | "TAX" | "DISCOUNT" | "PAYMENT" | "BAG" | "FEE" | "POINTS" | "LABEL_INFO" | "NOISE";
export type SkippedReceiptLine = { rawText: string; reason: ReceiptSkipReason };
export type ParsedReceipt = { items: RawReceiptItem[]; skipped: SkippedReceiptLine[] };

export type OcrOutput =
  | { kind: "text"; lines: OcrLine[] }
  | { kind: "items"; items: RawReceiptItem[]; rawLines: string[]; usage?: { inputTokens: number; outputTokens: number } };

export interface ReceiptOcrProvider {
  readonly id: ReceiptProviderId;
  isAvailable(): boolean;
  /** Còn nhận thêm yêu cầu không (hàng đợi chưa đầy). */
  canAccept(): boolean;
  /** `image` đã xoay, xóa EXIF, thu nhỏ (receipt-image.ts). `onProgress` 0–1 khi nhà cung cấp báo được tiến độ. */
  read(image: Buffer, onProgress?: (progress: number) => void): Promise<OcrOutput>;
}
