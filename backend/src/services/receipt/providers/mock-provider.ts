import type { OcrOutput, ReceiptOcrProvider } from "../receipt-types.js";

// Nhà cung cấp giả cho test và script đánh giá (--provider mock): trả các dòng chữ cố định, không đọc ảnh.
export const MOCK_RECEIPT_LINES = [
  "SIEU THI MAU", "Ngay: 09/11/2026 10:35", "THIT HEO XAY 0,5 kg 130.000 65.000", "TRUNG GA 10 3.200 32.000",
  "RAU MUONG 1 bo 8.000", "Tui nilon 1 500", "TONG CONG 105.500", "Tien khach dua 200.000",
];

export class MockProvider implements ReceiptOcrProvider {
  readonly id = "mock" as const;

  constructor(private readonly lines: string[] = MOCK_RECEIPT_LINES) {}

  isAvailable() {
    return true;
  }

  canAccept() {
    return true;
  }

  async read(_image: Buffer, onProgress?: (progress: number) => void): Promise<OcrOutput> {
    onProgress?.(1);
    return { kind: "text", lines: this.lines.map((text) => ({ text, confidence: 95 })) };
  }
}
