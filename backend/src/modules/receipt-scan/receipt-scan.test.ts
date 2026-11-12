import jwt from "jsonwebtoken";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockProvider } from "../../services/receipt/providers/mock-provider.js";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import { jpegWithGps } from "../../test/image-fixtures.js";
import { receiptJobs } from "./receipt-scan.jobs.js";
import receiptScanRoutes from "./receipt-scan.routes.js";
import { RECEIPT_CREATED_NOTE } from "./receipt-scan.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  countScans: vi.fn(), createScan: vi.fn(), findScan: vi.fn(), updateScans: vi.fn(),
  listPantry: vi.fn(), createPantry: vi.fn(), updatePantry: vi.fn(), findFirstPantry: vi.fn(), deletePantry: vi.fn(),
  createHistory: vi.fn(), listHistory: vi.fn(), updateHistory: vi.fn(), countHistory: vi.fn(),
  findProfile: vi.fn(), listIngredients: vi.fn(), transaction: vi.fn(), syncNotifications: vi.fn(),
  receiptProvider: vi.fn(), providerOptions: vi.fn(), defaultProvider: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret, RECEIPT_SCAN_DAILY_LIMIT: 2, OPENAI_MODEL: "test" } }));
vi.mock("../notifications/notifications.service.js", () => ({ syncPantryNotifications: mocks.syncNotifications }));
vi.mock("../../services/receipt/ocr-providers.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../services/receipt/ocr-providers.js")>(),
  receiptProvider: mocks.receiptProvider, receiptProviderOptions: mocks.providerOptions, defaultReceiptProvider: mocks.defaultProvider,
}));
const client = () => ({
  receiptScan: { count: mocks.countScans, create: mocks.createScan, findFirst: mocks.findScan, updateMany: mocks.updateScans },
  pantryItem: {
    findMany: mocks.listPantry, create: mocks.createPantry, updateMany: mocks.updatePantry, findFirst: mocks.findFirstPantry, deleteMany: mocks.deletePantry,
  },
  pantryTransaction: { create: mocks.createHistory, findMany: mocks.listHistory, updateMany: mocks.updateHistory, count: mocks.countHistory },
  nutritionProfile: { findUnique: mocks.findProfile },
  recipeIngredient: { findMany: mocks.listIngredients },
});
const tx = fakeTransaction(client);
vi.mock("../../lib/prisma.js", () => ({ prisma: new Proxy({}, {
  get: (_target, key) => (key === "$transaction" ? mocks.transaction : Reflect.get(client(), key)),
}) }));

const app = testApp("/api/pantry/receipt-scans", receiptScanRoutes);
const userId = "user-a";
const scanId = "cm70000000000000000000001";
const token = (sub = userId) => `Bearer ${jwt.sign({ sub, email: `${sub}@nouri.vn` }, mocks.secret)}`;
const now = Date.now();
const day = (offset: number) => new Date(now + offset * 86_400_000);
let provider: MockProvider;

const upload = async (image?: Buffer, fields: Record<string, string> = {}) => {
  const form = new FormData();
  if (image) form.append("image", new Blob([new Uint8Array(image)], { type: "image/jpeg" }), "receipt.jpg");
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return request(app, "/api/pantry/receipt-scans", { method: "POST", token: token(), form });
};
const get = (sub = userId) => request(app, `/api/pantry/receipt-scans/${scanId}`, { token: token(sub) });
const commit = (lines: unknown[], sub = userId) =>
  request(app, `/api/pantry/receipt-scans/${scanId}/commit`, { method: "POST", token: token(sub), body: { lines } });
const undo = (sub = userId) => request(app, `/api/pantry/receipt-scans/${scanId}/undo`, { method: "POST", token: token(sub) });
const scanRow = (status: string, extra = {}) => ({
  id: scanId, provider: "TESSERACT", status, lineCount: 0, createdAt: day(0), committedAt: null, reversedAt: null, ...extra,
});
const line = (overrides = {}) => ({
  name: "Thịt heo xay", quantity: 0.5, unit: "KG", category: "Thịt & cá", storageLocation: "REFRIGERATOR",
  expiryDate: "2026-11-11", expiryEstimated: true, ...overrides,
});
const historyData = () => mocks.createHistory.mock.calls.map(([args]) => args.data);

/** Đọc nền chạy sau khi POST trả 202: chờ tới khi GET báo xong. */
async function waitForScan() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await get();
    if (!["queued", "reading", "parsing"].includes(response.body?.phase)) return response;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Quét không xong");
}

beforeEach(() => {
  vi.resetAllMocks();
  receiptJobs.clear();
  provider = new MockProvider();
  vi.spyOn(provider, "read");
  mocks.receiptProvider.mockReturnValue(provider);
  mocks.defaultProvider.mockReturnValue("tesseract");
  mocks.providerOptions.mockReturnValue([{ id: "tesseract", available: true, reason: null }, { id: "openai", available: false, reason: "Cần OPENAI_API_KEY" }]);
  mocks.countScans.mockResolvedValue(0);
  mocks.createScan.mockResolvedValue({ id: scanId });
  mocks.findScan.mockResolvedValue(scanRow("PROCESSING"));
  mocks.updateScans.mockResolvedValue({ count: 1 });
  mocks.listPantry.mockResolvedValue([]);
  mocks.createPantry.mockImplementation(async ({ data }) => ({ id: `cm6000000000000000000000${mocks.createPantry.mock.calls.length}`, ...data }));
  mocks.updatePantry.mockResolvedValue({ count: 1 });
  mocks.deletePantry.mockResolvedValue({ count: 1 });
  mocks.createHistory.mockImplementation(async ({ data }) => ({ id: `tx-${mocks.createHistory.mock.calls.length}`, ...data }));
  mocks.listHistory.mockResolvedValue([]);
  mocks.updateHistory.mockResolvedValue({ count: 1 });
  mocks.countHistory.mockResolvedValue(0);
  mocks.findProfile.mockResolvedValue({ allergies: [], dislikedFoods: [] });
  mocks.listIngredients.mockResolvedValue([{ name: "Thịt heo xay" }, { name: "Rau muống" }, { name: "Trứng gà" }]);
  mocks.syncNotifications.mockResolvedValue(0);
  mocks.transaction.mockImplementation(tx.run);
});

describe("GET /status", () => {
  it("chế độ đọc và số lần còn lại hôm nay (đếm từ 00:00 giờ Việt Nam)", async () => {
    mocks.countScans.mockResolvedValue(1);
    const response = await request(app, "/api/pantry/receipt-scans/status", { token: token() });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ defaultProvider: "tesseract", dailyLimit: 2, usedToday: 1, remainingToday: 1 });
    const where = mocks.countScans.mock.calls[0][0].where;
    expect(where.userId).toBe(userId);
    expect(new Date(where.createdAt.gte).getUTCHours()).toBe(17); // 00:00 UTC+7 = 17:00 UTC hôm trước
  });

  it("cần đăng nhập", async () => {
    expect((await request(app, "/api/pantry/receipt-scans/status")).status).toBe(401);
  });
});

describe("POST / — nhận ảnh, đọc nền", () => {
  it("trả 202 ngay, đọc xong thì có dòng nháp đã chuẩn hóa; ảnh gửi vào OCR đã xóa EXIF/GPS", async () => {
    const response = await upload(await jpegWithGps(), { provider: "tesseract" });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ id: scanId, provider: "tesseract", phase: "queued" });
    expect(mocks.createScan).toHaveBeenCalledWith({ data: { userId, provider: "TESSERACT" }, select: { id: true } });

    mocks.findScan.mockResolvedValue(scanRow("READY"));
    const done = await waitForScan();
    expect(done.body.phase).toBe("ready");
    expect(done.body.draft.items.map((item: { name: string }) => item.name)).toEqual(["Thịt heo xay", "Trứng gà", "Rau muống"]);
    expect(done.body.draft.items[0]).toMatchObject({ quantity: 0.5, unit: "KG", category: "Thịt & cá", expiryEstimated: true, target: { kind: "create" } });
    expect(done.body.draft.skipped.map((entry: { reason: string }) => entry.reason)).toEqual(expect.arrayContaining(["BAG", "TOTAL", "PAYMENT"]));
    expect(mocks.updateScans).toHaveBeenCalledWith({
      where: { id: scanId, status: "PROCESSING" }, data: expect.objectContaining({ status: "READY", lineCount: 3 }),
    });

    const image = vi.mocked(provider.read).mock.calls[0][0];
    const metadata = await sharp(image).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("png");
  });

  it("thiếu ảnh hoặc không phải ảnh → 422, không tạo lần quét", async () => {
    expect((await upload()).status).toBe(422);
    expect((await upload(Buffer.from("not an image at all"))).status).toBe(422);
    expect(mocks.createScan).not.toHaveBeenCalled();
  });

  it("hết lượt hôm nay → 429, không đọc ảnh", async () => {
    mocks.countScans.mockResolvedValue(2);
    const response = await upload(await jpegWithGps());
    expect(response.status).toBe(429);
    expect(response.body.message).toContain("2 lần");
    expect(mocks.createScan).not.toHaveBeenCalled();
  });

  it("đang có lần quét chưa xong → 409", async () => {
    vi.mocked(provider.read).mockReturnValue(new Promise(() => undefined));
    expect((await upload(await jpegWithGps())).status).toBe(202);
    expect((await upload(await jpegWithGps())).status).toBe(409);
    expect(mocks.createScan).toHaveBeenCalledOnce();
  });

  it("chế độ chưa dùng được (OpenAI chưa có key) → 503 kèm lý do", async () => {
    mocks.receiptProvider.mockReturnValue(null);
    const response = await upload(await jpegWithGps(), { provider: "openai" });
    expect(response.status).toBe(503);
    expect(response.body.message).toContain("OPENAI_API_KEY");
  });

  it("đọc lỗi → phase failed, lần quét FAILED (vẫn tính lượt)", async () => {
    vi.mocked(provider.read).mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await upload(await jpegWithGps());
    const done = await waitForScan();
    expect(done.body).toMatchObject({ phase: "failed", draft: null });
    expect(mocks.updateScans).toHaveBeenCalledWith({
      where: { id: scanId, status: "PROCESSING" }, data: expect.objectContaining({ status: "FAILED", errorCode: "READ_FAILED" }),
    });
  });
});

describe("POST /:id/cancel", () => {
  const cancel = (sub = userId) => request(app, `/api/pantry/receipt-scans/${scanId}/cancel`, { method: "POST", token: token(sub) });

  it("hủy lần quét đang đọc: FAILED (CANCELLED), kết quả đọc về sau bị bỏ, quét tiếp được ngay", async () => {
    let finish!: (value: Awaited<ReturnType<MockProvider["read"]>>) => void;
    vi.mocked(provider.read).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await upload(await jpegWithGps());
    const response = await cancel();
    expect(response.status).toBe(200);
    expect(mocks.updateScans).toHaveBeenCalledWith({ where: { id: scanId, userId, status: "PROCESSING" }, data: { status: "FAILED", errorCode: "CANCELLED" } });
    expect((await get()).body).toMatchObject({ phase: "failed", error: "Đã hủy lần quét." });

    finish({ kind: "text", lines: [{ text: "Trứng gà 10 3.200 32.000", confidence: 95 }] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((await get()).body).toMatchObject({ phase: "failed", draft: null });
    expect(mocks.updateScans).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "READY" }) }));
    expect((await upload(await jpegWithGps())).status).toBe(202);
  });

  it("đã đọc xong → 409; của người khác → 404", async () => {
    mocks.findScan.mockResolvedValueOnce({ status: "READY" }).mockResolvedValueOnce(null);
    expect((await cancel()).status).toBe(409);
    expect((await cancel("user-b")).status).toBe(404);
    expect(mocks.updateScans).not.toHaveBeenCalled();
  });
});

describe("GET /:id", () => {
  it("lần quét của người khác → 404 (lọc theo userId từ JWT)", async () => {
    mocks.findScan.mockResolvedValue(null);
    expect((await get("user-b")).status).toBe(404);
    expect(mocks.findScan).toHaveBeenCalledWith(expect.objectContaining({ where: { id: scanId, userId: "user-b" } }));
  });

  it("server khởi động lại giữa chừng (không còn trong bộ nhớ) → FAILED INTERRUPTED", async () => {
    const response = await get();
    expect(response.body).toMatchObject({ phase: "failed", status: "FAILED" });
    expect(mocks.updateScans).toHaveBeenCalledWith({ where: { id: scanId, status: "PROCESSING" }, data: { status: "FAILED", errorCode: "INTERRUPTED" } });
  });

  it("đã lưu → phase committed, không trả dòng nháp", async () => {
    mocks.findScan.mockResolvedValue(scanRow("COMMITTED"));
    expect((await get()).body).toMatchObject({ phase: "committed", draft: null });
  });
});

describe("POST /:id/commit", () => {
  it("dòng có thành tiền → lưu đơn giá (đ / đơn vị) vào thực phẩm và ảnh chụp ở lịch sử kho; không có giá thì để trống", async () => {
    mocks.findScan.mockResolvedValue(scanRow("READY"));
    await commit([line({ price: 65_000 }), line({ name: "Rau muống", quantity: 1, unit: "ITEM", category: "Rau củ", expiryDate: null })]);
    expect(mocks.createPantry.mock.calls[0][0].data.unitPrice).toBe(130_000);
    expect(mocks.createPantry.mock.calls[1][0].data).not.toHaveProperty("unitPrice");
    expect(historyData()[0]).toMatchObject({ unitPrice: 130_000, category: "Thịt & cá" });
  });

  it("lưu các dòng đã duyệt trong một transaction, nguồn RECEIPT_SCAN gắn receiptScanId", async () => {
    const eggs = { id: "cm61111111111111111111111", userId, name: "Trứng gà", quantity: 4, unit: "ITEM", expiryDate: day(10) };
    mocks.listPantry.mockResolvedValue([eggs]);
    const response = await commit([line(), line({ name: "Trứng gà", quantity: 10, unit: "ITEM", category: "Trứng & sữa", expiryDate: null })]);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: scanId, status: "COMMITTED", added: [{ action: "CREATED" }, { action: "MERGED", quantityAfter: 14 }] });
    expect(mocks.updateScans).toHaveBeenCalledWith({
      where: { id: scanId, userId, status: "READY" }, data: expect.objectContaining({ status: "COMMITTED", lineCount: 2 }),
    });
    expect(mocks.createPantry).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId, name: "Thịt heo xay", quantity: 0.5, unit: "KG", expiryDate: new Date("2026-11-11T00:00:00.000Z"), expiryEstimated: true,
    }) });
    expect(mocks.updatePantry).toHaveBeenCalledWith({ where: { id: eggs.id, userId, quantity: 4 }, data: { quantity: 14 } });
    expect(historyData()).toEqual([
      expect.objectContaining({ source: "RECEIPT_SCAN", receiptScanId: scanId, delta: 0.5, note: RECEIPT_CREATED_NOTE }),
      expect.objectContaining({ source: "RECEIPT_SCAN", receiptScanId: scanId, delta: 10, note: null }),
    ]);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.updateScans)).toBe(true);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.createHistory, 1)).toBe(true);
    expect(mocks.syncNotifications).toHaveBeenCalledWith(userId);
  });

  it("lưu lần hai → 409, không ghi kho", async () => {
    mocks.updateScans.mockResolvedValue({ count: 0 });
    mocks.findScan.mockResolvedValue({ status: "COMMITTED" });
    const response = await commit([line()]);
    expect(response.status).toBe(409);
    expect(response.body.message).toContain("đã được lưu");
    expect(mocks.createPantry).not.toHaveBeenCalled();
    expect(mocks.createHistory).not.toHaveBeenCalled();
  });

  it("lần quét của người khác → 404, không ghi kho", async () => {
    mocks.updateScans.mockResolvedValue({ count: 0 });
    mocks.findScan.mockResolvedValue(null);
    expect((await commit([line()], "user-b")).status).toBe(404);
    expect(mocks.updateScans).toHaveBeenCalledWith(expect.objectContaining({ where: { id: scanId, userId: "user-b", status: "READY" } }));
    expect(mocks.createPantry).not.toHaveBeenCalled();
  });

  it.each([
    ["không có dòng nào", []],
    ["đơn vị lạ", [line({ unit: "BOX" })]],
    ["nhóm ngoài 8 nhóm", [line({ category: "Đồ ăn vặt" })]],
    ["số lượng 0", [line({ quantity: 0 })]],
    ["ngày sai định dạng", [line({ expiryDate: "11/11/2026" })]],
  ])("dữ liệu sai (%s) → 422", async (_label, lines) => {
    expect((await commit(lines)).status).toBe(422);
    expect(mocks.updateScans).not.toHaveBeenCalled();
  });
});

describe("POST /:id/undo", () => {
  const original = (id: string, pantryItemId: string, delta: number, quantityAfter: number, note: string | null) => ({
    id, userId, pantryItemId, itemName: "x", unit: "ITEM", delta, quantityAfter, source: "RECEIPT_SCAN", note,
    receiptScanId: scanId, reversalOfId: null, reversedAt: null, createdAt: day(0),
  });

  it("hoàn cả lô: món do lô tạo chưa ai đụng → xóa; món đã cộng vào và bị dùng bớt → trừ phần còn, báo phần thiếu", async () => {
    const created = { id: "cm62222222222222222222222", userId, name: "Rau muống", quantity: 1, unit: "ITEM", createdAt: day(0), updatedAt: day(0) };
    const merged = { id: "cm63333333333333333333333", userId, name: "Trứng gà", quantity: 6, unit: "ITEM", createdAt: day(-5), updatedAt: day(0) };
    mocks.listHistory.mockResolvedValue([
      original("tx-1", created.id, 1, 1, RECEIPT_CREATED_NOTE), original("tx-2", merged.id, 10, 14, null),
    ]);
    mocks.findFirstPantry.mockImplementation(async ({ where }) => [created, merged].find((item) => item.id === where.id) ?? null);
    const response = await undo();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "REVERSED",
      restored: [{ pantryItemId: created.id, removed: true }, { pantryItemId: merged.id, quantity: 6, quantityAfter: 0, removed: false }],
      skipped: [{ itemName: "Trứng gà", quantity: 4, reason: "INSUFFICIENT" }],
    });
    expect(mocks.updateScans).toHaveBeenCalledWith({ where: { id: scanId, userId, status: "COMMITTED" }, data: expect.objectContaining({ status: "REVERSED" }) });
    expect(mocks.listHistory).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, receiptScanId: scanId, source: "RECEIPT_SCAN", reversalOfId: null, reversedAt: null },
    }));
    expect(mocks.deletePantry).toHaveBeenCalledWith({ where: { id: created.id, userId, quantity: 1 } });
    expect(historyData()).toEqual([
      expect.objectContaining({ reversalOfId: "tx-1", receiptScanId: scanId, delta: -1 }),
      expect.objectContaining({ reversalOfId: "tx-2", receiptScanId: scanId, delta: -6 }),
    ]);
  });

  it("hoàn tác lần hai → 409; chưa lưu → 409; của người khác → 404", async () => {
    mocks.updateScans.mockResolvedValue({ count: 0 });
    mocks.findScan.mockResolvedValueOnce({ status: "REVERSED" }).mockResolvedValueOnce({ status: "READY" }).mockResolvedValueOnce(null);
    expect((await undo()).status).toBe(409);
    expect((await undo()).status).toBe(409);
    expect((await undo("user-b")).status).toBe(404);
    expect(mocks.listHistory).not.toHaveBeenCalled();
  });
});

describe("POST / — chế độ Tự động / Đọc bằng AI / Chế độ dự phòng", () => {
  const bothAvailable = () => mocks.providerOptions.mockReturnValue([
    { id: "tesseract", available: true, reason: null }, { id: "openai", available: true, reason: null },
  ]);
  const openaiWith = (read: () => Promise<unknown>) => {
    const openai = { id: "openai", isAvailable: () => true, canAccept: () => true, read: vi.fn((_image: Buffer) => read()) };
    mocks.receiptProvider.mockImplementation((id: string) => (id === "openai" ? openai : provider));
    return openai;
  };
  const usage = { inputTokens: 1500, outputTokens: 400 };

  it("Tự động: OpenAI đọc được → không dùng Tesseract, ghi token vào/ra", async () => {
    bothAvailable();
    const openai = openaiWith(async () => ({
      kind: "items", usage,
      items: [{ rawText: "TRUNG GA 10", name: "Trứng gà", quantity: 10, unit: "ITEM", unitPrice: null, price: null, expiryDate: null, confidence: null, consistent: null }],
      rawLines: ["TRUNG GA 10"],
    }));
    const response = await upload(await jpegWithGps());
    expect(response.body).toEqual({ id: scanId, provider: "openai", phase: "queued" });
    expect(mocks.createScan).toHaveBeenCalledWith({ data: { userId, provider: "OPENAI" }, select: { id: true } });
    const done = await waitForScan();
    expect(done.body).toMatchObject({ phase: "ready", provider: "openai", fallbackCode: null });
    expect(openai.read).toHaveBeenCalledOnce();
    expect(provider.read).not.toHaveBeenCalled();
    expect(mocks.updateScans).toHaveBeenCalledWith({
      where: { id: scanId, status: "PROCESSING" }, data: expect.objectContaining({ status: "READY", ...usage, fallbackCode: null }),
    });
    expect((await sharp(openai.read.mock.calls[0][0]).metadata()).format).toBe("jpeg");
  });

  it.each(["OPENAI_TIMEOUT", "OPENAI_FAILED", "OPENAI_INVALID_OUTPUT"] as const)(
    "Tự động: OpenAI lỗi %s → tự đọc lại bằng Tesseract, màn duyệt biết lý do, DB ghi provider TESSERACT",
    async (code) => {
      bothAvailable();
      const { VisionReadError } = await import("../../services/receipt/providers/openai-vision-provider.js");
      openaiWith(async () => { throw new VisionReadError(code, code === "OPENAI_INVALID_OUTPUT" ? usage : null); });
      await upload(await jpegWithGps(), { provider: "auto" });
      const done = await waitForScan();
      expect(done.body).toMatchObject({ phase: "ready", provider: "tesseract", fallbackCode: code });
      expect(done.body.draft.items.length).toBe(3);
      expect((await sharp(vi.mocked(provider.read).mock.calls[0][0]).metadata()).format).toBe("png"); // ảnh xử lý lại cho OCR
      expect(mocks.updateScans).toHaveBeenCalledWith({
        where: { id: scanId, status: "PROCESSING" },
        data: expect.objectContaining({ status: "READY", provider: "TESSERACT", fallbackCode: code, ...(code === "OPENAI_INVALID_OUTPUT" ? usage : {}) }),
      });
    },
  );

  it("Đọc bằng AI (chọn hẳn): OpenAI lỗi → báo lỗi, không tự chuyển Tesseract", async () => {
    bothAvailable();
    const { VisionReadError } = await import("../../services/receipt/providers/openai-vision-provider.js");
    openaiWith(async () => { throw new VisionReadError("OPENAI_TIMEOUT"); });
    await upload(await jpegWithGps(), { provider: "openai" });
    const done = await waitForScan();
    expect(done.body.phase).toBe("failed");
    expect(done.body.error).toContain("Chế độ dự phòng");
    expect(provider.read).not.toHaveBeenCalled();
    expect(mocks.updateScans).toHaveBeenCalledWith({
      where: { id: scanId, status: "PROCESSING" }, data: expect.objectContaining({ status: "FAILED", errorCode: "OPENAI_TIMEOUT" }),
    });
  });

  it("Tự động khi không có key → đọc bằng Tesseract; chế độ lạ bị từ chối", async () => {
    await upload(await jpegWithGps(), { provider: "auto" });
    expect(mocks.createScan).toHaveBeenCalledWith({ data: { userId, provider: "TESSERACT" }, select: { id: true } });
    await waitForScan();
    expect((await upload(await jpegWithGps(), { provider: "google" })).status).toBe(422);
  });
});
