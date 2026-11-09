import { isAIConfigured } from "../../modules/ai/openai.service.js";
import { TesseractProvider } from "./providers/tesseract-provider.js";
import type { ReceiptOcrProvider } from "./receipt-types.js";

// Chọn nhà cung cấp OCR cho quét hóa đơn (GĐ3c). Phần 1: chỉ Tesseract. Phần 2 thêm OpenAIVisionProvider (cần OPENAI_API_KEY);
// khi đó có key → mặc định OpenAI, người dùng vẫn chọn được Tesseract.

export type SelectableProvider = "tesseract" | "openai";
export type ProviderOption = { id: SelectableProvider; available: boolean; reason: string | null };

const tesseract = new TesseractProvider();

export function receiptProvider(id: SelectableProvider): ReceiptOcrProvider | null {
  if (id === "tesseract") return tesseract.isAvailable() ? tesseract : null;
  return null; // OpenAI: phần 2
}

export function receiptProviderOptions(): ProviderOption[] {
  return [
    { id: "tesseract", available: tesseract.isAvailable(), reason: tesseract.isAvailable() ? null : "Thiếu dữ liệu nhận dạng chữ trên máy chủ." },
    {
      id: "openai", available: false,
      reason: isAIConfigured() ? "Chế độ đọc bằng OpenAI chưa được bật ở phiên bản này." : "Cần cấu hình OPENAI_API_KEY trên máy chủ.",
    },
  ];
}

export function defaultReceiptProvider(): SelectableProvider | null {
  return receiptProviderOptions().find((option) => option.available)?.id ?? null;
}
