import { APIConnectionError, APIConnectionTimeoutError } from "openai";
import { describe, expect, it, vi } from "vitest";
import { parseOcrOutput } from "../receipt-parser.js";
import { scanPlan, type ProviderOption } from "../ocr-providers.js";
import { OpenAIVisionProvider, VisionReadError } from "./openai-vision-provider.js";

vi.mock("../../../config/env.js", () => ({ env: { OPENAI_MODEL: "m", OPENAI_VISION_MODEL: "m" } }));

// Phản hồi giả lập của Responses API, không gọi OpenAI thật.
const fakeClient = (create: (...args: unknown[]) => Promise<unknown>) => ({ responses: { create: vi.fn(create) } }) as never;
const reply = (body: unknown, extra = {}) => async () => ({
  status: "completed", output_text: typeof body === "string" ? body : JSON.stringify(body), usage: { input_tokens: 1200, output_tokens: 300 }, ...extra,
});
const line = (overrides = {}) => ({
  rawText: "THIT HEO XAY 0,5 kg 130.000 65.000", name: "Thịt heo xay", quantity: 0.5, unit: "KG", unitPrice: 130000, price: 65000,
  expiryDate: null, ...overrides,
});
const image = Buffer.from("jpeg");

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(VisionReadError);
  return error as VisionReadError;
}

describe("OpenAIVisionProvider", () => {
  it("schema hợp lệ: trả dòng hàng theo dạng của bộ phân tích, kèm token; gửi ảnh base64, không thử lại, có timeout", async () => {
    const client = fakeClient(reply({ items: [line(), line({ rawText: "TONG CONG 65.000", name: "Tổng cộng", quantity: null, unit: null })] }));
    const output = await new OpenAIVisionProvider(client, "gpt-5-mini", 1234).read(image);
    expect(output).toMatchObject({ kind: "items", usage: { inputTokens: 1200, outputTokens: 300 } });
    const parsed = parseOcrOutput(output);
    expect(parsed.items).toEqual([expect.objectContaining({ name: "Thịt heo xay", quantity: 0.5, unit: "KG", price: 65000, confidence: null })]);
    expect(parsed.skipped).toEqual([{ rawText: "TONG CONG 65.000", reason: "TOTAL" }]);

    const [body, options] = (client as { responses: { create: ReturnType<typeof vi.fn> } }).responses.create.mock.calls[0];
    expect(options).toEqual({ timeout: 1234, maxRetries: 0 });
    expect(body.model).toBe("gpt-5-mini");
    expect(body.text.format).toMatchObject({ type: "json_schema", name: "receipt_items", strict: true });
    expect(JSON.stringify(body.input)).toContain(`data:image/jpeg;base64,${image.toString("base64")}`);
  });

  it("làm sạch giá trị: hạn dùng sai dạng → null, số âm/0 → null, dòng không có tên bị bỏ", async () => {
    const client = fakeClient(reply({ items: [line({ expiryDate: "12/11/2026", quantity: 0, price: -5 }), line({ name: "  " })] }));
    const output = await new OpenAIVisionProvider(client, "gpt-4.1-mini").read(image);
    expect(output.kind === "items" && output.items).toEqual([expect.objectContaining({ expiryDate: null, quantity: null, price: null })]);
  });

  it.each([
    ["không phải JSON", reply("Xin lỗi, tôi không đọc được")],
    ["sai schema (đơn vị lạ)", reply({ items: [line({ unit: "THUNG" })] })],
    ["thiếu trường", reply({ items: [{ name: "Trứng" }] })],
    ["phản hồi chưa hoàn tất", reply({ items: [line()] }, { status: "incomplete" })],
  ])("schema không hợp lệ (%s) → OPENAI_INVALID_OUTPUT, vẫn giữ số token đã tốn", async (_label, create) => {
    const error = await codeOf(new OpenAIVisionProvider(fakeClient(create), "gpt-5-mini").read(image));
    expect(error.code).toBe("OPENAI_INVALID_OUTPUT");
    expect(error.usage).toEqual({ inputTokens: 1200, outputTokens: 300 });
  });

  it("lỗi mạng → OPENAI_FAILED; hết thời gian → OPENAI_TIMEOUT", async () => {
    const network = fakeClient(async () => { throw new APIConnectionError({ message: "ECONNRESET" }); });
    expect((await codeOf(new OpenAIVisionProvider(network, "m").read(image))).code).toBe("OPENAI_FAILED");
    const slow = fakeClient(async () => { throw new APIConnectionTimeoutError(); });
    expect((await codeOf(new OpenAIVisionProvider(slow, "m").read(image))).code).toBe("OPENAI_TIMEOUT");
  });

  it("không có key: không dùng được", async () => {
    const provider = new OpenAIVisionProvider(null, "m");
    expect(provider.isAvailable()).toBe(false);
    expect((await codeOf(provider.read(image))).code).toBe("OPENAI_FAILED");
  });
});

describe("scanPlan — thứ tự đọc theo chế độ", () => {
  const options = (openai: boolean, tesseract: boolean): ProviderOption[] => [
    { id: "tesseract", available: tesseract, reason: null }, { id: "openai", available: openai, reason: null },
  ];
  it.each([
    [true, true, ["openai", "tesseract"]],
    [true, false, ["openai"]],
    [false, true, ["tesseract"]],
    [false, false, []],
  ])("Tự động (openai=%s, tesseract=%s) → %j", (openai, tesseract, expected) => {
    expect(scanPlan("auto", options(openai, tesseract))).toEqual(expected);
  });
  it("chọn hẳn một chế độ thì không có dự phòng", () => {
    expect(scanPlan("openai", options(true, true))).toEqual(["openai"]);
    expect(scanPlan("tesseract", options(true, true))).toEqual(["tesseract"]);
  });
});
