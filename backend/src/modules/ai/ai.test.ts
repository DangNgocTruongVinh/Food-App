import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import aiRoutes from "./ai.routes.js";
import { generatePlanWithAI } from "./ai.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  listHistory: vi.fn(),
  findProfile: vi.fn(),
  listPantry: vi.fn(),
  findPlan: vi.fn(),
  createMessages: vi.fn(),
  countMessages: vi.fn(),
  requestMealPlan: vi.fn(),
  requestNutritionAnswer: vi.fn(),
  isAIConfigured: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret, AI_CHAT_DAILY_LIMIT: 3 } }));
vi.mock("../../services/receipt/ocr-providers.js", () => ({
  receiptProviderOptions: () => [{ id: "tesseract", available: true, reason: null }, { id: "openai", available: false, reason: "Cần key" }],
  defaultReceiptProvider: () => "tesseract",
}));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    chatMessage: { findMany: mocks.listHistory, createMany: mocks.createMessages, count: mocks.countMessages },
    nutritionProfile: { findUnique: mocks.findProfile },
    pantryItem: { findMany: mocks.listPantry },
    mealPlan: { findFirst: mocks.findPlan },
  },
}));
vi.mock("./openai.service.js", () => ({
  requestMealPlan: mocks.requestMealPlan,
  requestNutritionAnswer: mocks.requestNutritionAnswer,
  isAIConfigured: mocks.isAIConfigured,
}));

const app = testApp("/api/ai", aiRoutes);
const userId = "user-a";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "demo@nouri.vn" }, mocks.secret)}`;
const messages = [
  { id: "message-a", userId, role: "user", content: "Tôi nên ăn gì?", createdAt: new Date("2026-09-15T08:00:00.000Z") },
  { id: "message-b", userId, role: "assistant", content: "Bạn có thể ăn ức gà.", createdAt: new Date("2026-09-15T08:00:01.000Z") },
];
const profile = { userId, dietType: "BALANCED", allergies: ["Tôm"] };
const pantry = [{ name: "Ức gà", quantity: 500, unit: "G", expiryDate: null }];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.listHistory.mockResolvedValue(messages);
  mocks.findProfile.mockResolvedValue(profile);
  mocks.listPantry.mockResolvedValue(pantry);
  mocks.findPlan.mockResolvedValue(null);
  mocks.createMessages.mockResolvedValue({ count: 2 });
  mocks.requestNutritionAnswer.mockResolvedValue("Bạn có thể ăn ức gà.");
  mocks.requestMealPlan.mockResolvedValue({ summary: "Kế hoạch", days: [] });
  mocks.isAIConfigured.mockReturnValue(true);
  mocks.countMessages.mockResolvedValue(0);
});

afterEach(() => vi.restoreAllMocks());

describe("AI chat HTTP contract (no database or OpenAI request)", () => {
  it("lists the authenticated user's latest 50 messages; assistant messages carry allergy warnings from the current profile", async () => {
    const shrimp = { id: "message-c", userId, role: "assistant", content: "Thử món tôm rang me.", createdAt: new Date("2026-09-15T08:01:00.000Z") };
    mocks.listHistory.mockResolvedValue([...messages, shrimp]);
    const response = await request(app, "/api/ai/history?userId=user-b", { token: token() });
    expect(response.status).toBe(200);
    expect(response.body.map((item: { id: string; allergyWarnings: string[] }) => [item.id, item.allergyWarnings])).toEqual([
      ["message-a", []], ["message-b", []], ["message-c", ["tôm"]],
    ]);
    expect(mocks.listHistory).toHaveBeenCalledWith({ where: { userId }, orderBy: { createdAt: "asc" }, take: 50 });
  });

  it("builds chat context (profile, safety, pantry with expiring-soon items, meal plan) and sends the last turns as history", async () => {
    const now = Date.now();
    mocks.listPantry.mockResolvedValue([
      { name: "Ức gà", quantity: 500, unit: "G", expiryDate: null },
      { name: "Đậu hũ", quantity: 2, unit: "PACKAGE", expiryDate: new Date(now + 86_400_000) },
    ]);
    const response = await request(app, "/api/ai/chat", {
      method: "POST", token: token(), body: { message: "Tôi nên ăn gì?", userId: "user-b" },
    });
    expect(response).toEqual({ status: 200, body: { answer: "Bạn có thể ăn ức gà.", allergyWarnings: [] } });
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId } });
    expect(mocks.listPantry).toHaveBeenCalledWith({
      where: { userId, quantity: { gt: 0 } },
      select: { name: true, quantity: true, unit: true, expiryDate: true },
    });
    expect(mocks.findPlan).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId, status: "ACTIVE" }) }));
    const [context, question, history] = mocks.requestNutritionAnswer.mock.calls[0];
    expect(context).toMatchObject({
      profile: { dietType: "BALANCED", allergies: ["Tôm"] },
      safety: { avoidForAllergy: ["tôm"], avoidDisliked: [], requiredDiet: null },
      mealPlan: { status: "chưa có thực đơn" },
    });
    expect(context.pantry.items.map((item: { name: string }) => item.name)).toEqual(["Đậu hũ", "Ức gà"]); // hạn gần trước
    expect(context.pantry.expiringSoon).toEqual([{ name: "Đậu hũ", daysLeft: expect.any(Number) }]);
    expect(question).toBe("Tôi nên ăn gì?");
    expect(history).toHaveLength(2);
    expect(mocks.createMessages).toHaveBeenCalledWith({ data: [
      { userId, role: "user", content: "Tôi nên ăn gì?" },
      { userId, role: "assistant", content: "Bạn có thể ăn ức gà." },
    ] });
  });

  it("flags an answer that mentions a declared allergen", async () => {
    mocks.requestNutritionAnswer.mockResolvedValue("Bạn thử canh chua tôm và cá lóc nhé.");
    mocks.findProfile.mockResolvedValue({ ...profile, allergies: ["Hải sản"] });
    const response = await request(app, "/api/ai/chat", { method: "POST", token: token(), body: { message: "Tối nay ăn gì?" } });
    expect(response.body.allergyWarnings).toEqual(["tôm", "cá"]);
  });

  it("no OpenAI key → 503 AI_NOT_CONFIGURED, nothing stored, OpenAI not called", async () => {
    mocks.isAIConfigured.mockReturnValue(false);
    const response = await request(app, "/api/ai/chat", { method: "POST", token: token(), body: { message: "Gợi ý bữa tối" } });
    expect(response.status).toBe(503);
    expect(response.body.details).toEqual({ code: "AI_NOT_CONFIGURED" });
    expect(mocks.requestNutritionAnswer).not.toHaveBeenCalled();
    expect(mocks.createMessages).not.toHaveBeenCalled();
  });

  it("daily limit reached → friendly 429, counted from 00:00 Vietnam time, OpenAI not called", async () => {
    mocks.countMessages.mockResolvedValue(3);
    const response = await request(app, "/api/ai/chat", { method: "POST", token: token(), body: { message: "Câu hỏi" } });
    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ message: expect.stringContaining("3 câu"), details: { code: "AI_CHAT_LIMIT" } });
    const where = mocks.countMessages.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId, role: "user" });
    expect(new Date(where.createdAt.gte).getUTCHours()).toBe(17);
    expect(mocks.requestNutritionAnswer).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/ai/history", undefined],
    ["POST", "/api/ai/chat", { message: "Câu hỏi" }],
    ["GET", "/api/ai/status", undefined],
  ])("requires authentication for %s %s", async (method, path, body) => {
    expect(await request(app, path, { method, body })).toEqual({
      status: 401, body: { message: "Bạn cần đăng nhập để tiếp tục." },
    });
    expect(mocks.listHistory).not.toHaveBeenCalled();
    expect(mocks.requestNutritionAnswer).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { message: "" },
    { message: "a" },
    { message: "a".repeat(1001) },
    { message: 123 },
  ])("rejects invalid chat body %#", async (body) => {
    const response = await request(app, "/api/ai/chat", { method: "POST", token: token(), body });
    expect(response.status).toBe(422);
    expect(response.body.message).toBe("Dữ liệu gửi lên chưa hợp lệ.");
    expect(mocks.requestNutritionAnswer).not.toHaveBeenCalled();
  });

  it("uses the shared 500 response when history loading fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.listHistory.mockRejectedValue(new Error("database unavailable"));
    expect(await request(app, "/api/ai/history", { token: token() })).toEqual({
      status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." },
    });
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("OpenAI error → 503 AI_UNAVAILABLE and no partial history stored", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.requestNutritionAnswer.mockRejectedValue(new Error("OpenAI unavailable"));
    const response = await request(app, "/api/ai/chat", { method: "POST", token: token(), body: { message: "Tôi nên ăn gì?" } });
    expect(response.status).toBe(503);
    expect(response.body.details).toEqual({ code: "AI_UNAVAILABLE" });
    expect(mocks.createMessages).not.toHaveBeenCalled();
  });
});

describe("AI status", () => {
  it.each([true, false])("reports only whether OpenAI is configured (%s), never the key", async (available) => {
    mocks.isAIConfigured.mockReturnValue(available);
    expect(await request(app, "/api/ai/status", { token: token() })).toEqual({
      status: 200, body: { available, receiptScan: { auto: "tesseract", openai: false, tesseract: true } },
    });
  });
});

describe("Meal Plan AI compatibility", () => {
  it("keeps generatePlanWithAI(context) forwarding the same value", async () => {
    const context = { mealsPerDay: 3 };
    await expect(generatePlanWithAI(context)).resolves.toEqual({ summary: "Kế hoạch", days: [] });
    expect(mocks.requestMealPlan).toHaveBeenCalledWith(context);
  });
});
