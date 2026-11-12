import OpenAI, { APIConnectionTimeoutError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { OcrOutput, RawReceiptItem, ReceiptOcrProvider } from "../receipt-types.js";

// Đọc hóa đơn/nhãn bằng OpenAI Vision (GĐ3c phần 2): Responses API, ảnh JPEG đã qua sharp (receipt-image.ts "vision"),
// structured output theo đúng dạng RawReceiptItem của bộ phân tích. Ảnh chỉ gửi đi trong request, không lưu.
// Lỗi được quy về 3 mã để chế độ "Tự động" chuyển sang Tesseract và màn duyệt báo đúng lý do.

export const VISION_TIMEOUT_MS = 60_000;
const MAX_IN_FLIGHT = 4;

/** Schema gửi cho OpenAI (strict: mọi trường bắt buộc, không có thì null). */
export const visionReceiptSchema = z.object({
  items: z.array(z.object({
    rawText: z.string(),
    name: z.string(),
    quantity: z.number().nullable(),
    unit: z.enum(["G", "KG", "ML", "L", "ITEM", "PACKAGE"]).nullable(),
    unitPrice: z.number().nullable(),
    price: z.number().nullable(),
    expiryDate: z.string().nullable(),
  })),
});

export const VISION_SYSTEM_PROMPT = [
  "Bạn đọc ảnh hóa đơn mua hàng hoặc nhãn sản phẩm thực phẩm ở Việt Nam và trả về các dòng hàng.",
  "Chỉ liệt kê dòng hàng hóa; bỏ tên cửa hàng, ngày giờ, tổng tiền, VAT, giảm giá, tiền khách đưa/thối, túi nilon, phí, điểm thành viên.",
  "rawText: chép nguyên văn dòng trên ảnh. name: tên thực phẩm thường gọi, tiếng Việt có dấu, bỏ mã hàng và thương hiệu nếu không cần.",
  "quantity + unit: tổng lượng mua theo một trong G, KG, ML, L, ITEM (cái/quả/bó/con), PACKAGE (gói/hộp/chai/vỉ);",
  "hàng có quy cách × số lượng (vd. 4 hộp sữa 180 ml) ghi tổng 720 ML. Không đọc được thì null.",
  "unitPrice, price: đơn giá và thành tiền (đồng, số nguyên), không có thì null.",
  "expiryDate: hạn dùng in trên nhãn (HSD/EXP) dạng yyyy-MM-dd, không có thì null. Không bịa số liệu.",
  "Ảnh không phải hóa đơn hay nhãn thực phẩm thì trả items rỗng.",
].join("\n");

export type VisionErrorCode = "OPENAI_TIMEOUT" | "OPENAI_INVALID_OUTPUT" | "OPENAI_FAILED";
export type TokenUsage = { inputTokens: number; outputTokens: number };

export class VisionReadError extends Error {
  constructor(readonly code: VisionErrorCode, readonly usage: TokenUsage | null = null, cause?: unknown) {
    super(code, { cause });
  }
}

type VisionClient = Pick<OpenAI, "responses">;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const positiveOrNull = (value: number | null) => (value !== null && Number.isFinite(value) && value > 0 ? value : null);

function toRawItem(item: z.infer<typeof visionReceiptSchema>["items"][number]): RawReceiptItem {
  return {
    rawText: item.rawText.trim() || item.name.trim(),
    name: item.name.trim(),
    quantity: positiveOrNull(item.quantity),
    unit: item.unit,
    unitPrice: positiveOrNull(item.unitPrice),
    price: positiveOrNull(item.price),
    expiryDate: item.expiryDate && DATE.test(item.expiryDate) && !Number.isNaN(Date.parse(item.expiryDate)) ? item.expiryDate : null,
    confidence: null,
    // shortcut: AI chỉ trả tổng lượng, không tách số hộp × quy cách nên không kiểm SL × đơn giá; cần thì thêm trường "count".
    consistent: null,
  };
}

export class OpenAIVisionProvider implements ReceiptOcrProvider {
  readonly id = "openai" as const;
  private inFlight = 0;

  constructor(private readonly client: VisionClient | null, private readonly model: string, private readonly timeoutMs = VISION_TIMEOUT_MS) {}

  isAvailable() {
    return Boolean(this.client);
  }

  canAccept() {
    return this.inFlight < MAX_IN_FLIGHT;
  }

  async read(image: Buffer, onProgress?: (progress: number) => void): Promise<OcrOutput> {
    if (!this.client) throw new VisionReadError("OPENAI_FAILED");
    this.inFlight += 1;
    try {
      const response = await this.client.responses.create({
        model: this.model,
        // Model suy luận (gpt-5*): mức thấp đủ cho việc chép chữ, nhanh và rẻ hơn mặc định.
        ...(this.model.startsWith("gpt-5") ? { reasoning: { effort: "low" as const } } : {}),
        input: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Đọc các dòng hàng trên ảnh này." },
              { type: "input_image", image_url: `data:image/jpeg;base64,${image.toString("base64")}`, detail: "high" },
            ],
          },
        ],
        text: { format: zodTextFormat(visionReceiptSchema, "receipt_items") },
      }, { timeout: this.timeoutMs, maxRetries: 0 }).catch((error: unknown) => {
        throw new VisionReadError(error instanceof APIConnectionTimeoutError ? "OPENAI_TIMEOUT" : "OPENAI_FAILED", null, error);
      });
      const usage = { inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
      let parsed: z.infer<typeof visionReceiptSchema>;
      try {
        if (response.status && response.status !== "completed") throw new Error(`status ${response.status}`);
        parsed = visionReceiptSchema.parse(JSON.parse(response.output_text));
      } catch (error) {
        throw new VisionReadError("OPENAI_INVALID_OUTPUT", usage, error);
      }
      onProgress?.(1);
      const items = parsed.items.map(toRawItem).filter((item) => item.name);
      return { kind: "items", items, rawLines: items.map((item) => item.rawText), usage };
    } finally {
      this.inFlight -= 1;
    }
  }
}
