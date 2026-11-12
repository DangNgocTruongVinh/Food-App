import { env } from "../../config/env.js";
import { openAIClient } from "../../modules/ai/openai.service.js";
import { OpenAIVisionProvider } from "./providers/openai-vision-provider.js";
import { TesseractProvider } from "./providers/tesseract-provider.js";
import type { ReceiptOcrProvider } from "./receipt-types.js";

// Chọn nhà cung cấp OCR cho quét hóa đơn (GĐ3c). Ba chế độ cho người dùng:
//   "auto" (mặc định): OpenAI nếu có key, lỗi/hết thời gian thì tự đọc lại bằng Tesseract;
//   "openai" ("Đọc bằng AI"): chỉ OpenAI; "tesseract" ("Chế độ dự phòng"): chỉ Tesseract trên máy chủ.

export type SelectableProvider = "tesseract" | "openai";
export type ScanMode = "auto" | SelectableProvider;
export type ProviderOption = { id: SelectableProvider; available: boolean; reason: string | null };

const tesseract = new TesseractProvider();
const openai = new OpenAIVisionProvider(openAIClient, env.OPENAI_VISION_MODEL);

export function receiptProvider(id: SelectableProvider): ReceiptOcrProvider | null {
  const provider = id === "tesseract" ? tesseract : openai;
  return provider.isAvailable() ? provider : null;
}

export function receiptProviderOptions(): ProviderOption[] {
  return [
    { id: "tesseract", available: tesseract.isAvailable(), reason: tesseract.isAvailable() ? null : "Thiếu dữ liệu nhận dạng chữ trên máy chủ." },
    { id: "openai", available: openai.isAvailable(), reason: openai.isAvailable() ? null : "Cần cấu hình OPENAI_API_KEY trên máy chủ." },
  ];
}

/** Thứ tự đọc của một chế độ: [đọc trước, dự phòng?]. Rỗng khi chế độ "Tự động" không có nhà cung cấp nào dùng được. */
export function scanPlan(mode: ScanMode, options: ProviderOption[]): SelectableProvider[] {
  if (mode !== "auto") return [mode];
  const ok = (id: SelectableProvider) => options.some((option) => option.id === id && option.available);
  if (ok("openai")) return ok("tesseract") ? ["openai", "tesseract"] : ["openai"];
  return ok("tesseract") ? ["tesseract"] : [];
}

/** Nhà cung cấp đọc trước ở chế độ "Tự động". */
export const defaultReceiptProvider = (): SelectableProvider | null => scanPlan("auto", receiptProviderOptions())[0] ?? null;
