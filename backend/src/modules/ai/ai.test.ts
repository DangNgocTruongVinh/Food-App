import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import { missingAIChatResponse } from "./ai.prompts.js";
import aiRoutes from "./ai.routes.js";
import { generatePlanWithAI } from "./ai.service.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  listHistory: vi.fn(),
  findProfile: vi.fn(),
  listPantry: vi.fn(),
  createMessages: vi.fn(),
  requestMealPlan: vi.fn(),
  requestNutritionAnswer: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    chatMessage: { findMany: mocks.listHistory, createMany: mocks.createMessages },
    nutritionProfile: { findUnique: mocks.findProfile },
    pantryItem: { findMany: mocks.listPantry },
  },
}));
vi.mock("./openai.service.js", () => ({
  requestMealPlan: mocks.requestMealPlan,
  requestNutritionAnswer: mocks.requestNutritionAnswer,
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
  mocks.createMessages.mockResolvedValue({ count: 2 });
  mocks.requestNutritionAnswer.mockResolvedValue("Bạn có thể ăn ức gà.");
  mocks.requestMealPlan.mockResolvedValue({ summary: "Kế hoạch", days: [] });
});

afterEach(() => vi.restoreAllMocks());

describe("AI chat HTTP contract (no database or OpenAI request)", () => {
  it("lists the authenticated user's latest 50 messages in chronological order", async () => {
    const response = await request(app, "/api/ai/history?userId=user-b", { token: token() });
    expect(response).toEqual({ status: 200, body: JSON.parse(JSON.stringify(messages)) });
    expect(mocks.listHistory).toHaveBeenCalledWith({
      where: { userId }, orderBy: { createdAt: "asc" }, take: 50,
    });
  });

  it("builds chat context from the token owner's profile and positive Pantry items", async () => {
    const response = await request(app, "/api/ai/chat", {
      method: "POST", token: token(), body: { message: "Tôi nên ăn gì?", userId: "user-b" },
    });
    expect(response).toEqual({ status: 200, body: { answer: "Bạn có thể ăn ức gà." } });
    expect(mocks.findProfile).toHaveBeenCalledWith({ where: { userId } });
    expect(mocks.listPantry).toHaveBeenCalledWith({
      where: { userId, quantity: { gt: 0 } },
      select: { name: true, quantity: true, unit: true, expiryDate: true },
    });
    expect(mocks.requestNutritionAnswer).toHaveBeenCalledWith({ profile, pantry }, "Tôi nên ăn gì?");
    expect(mocks.createMessages).toHaveBeenCalledWith({ data: [
      { userId, role: "user", content: "Tôi nên ăn gì?" },
      { userId, role: "assistant", content: "Bạn có thể ăn ức gà." },
    ] });
  });

  it("preserves and stores the no-key chat fallback", async () => {
    mocks.requestNutritionAnswer.mockResolvedValue(missingAIChatResponse);
    const response = await request(app, "/api/ai/chat", {
      method: "POST", token: token(), body: { message: "Gợi ý bữa tối" },
    });
    expect(response).toEqual({ status: 200, body: { answer: missingAIChatResponse } });
    expect(mocks.createMessages.mock.calls[0][0].data[1]).toEqual({
      userId, role: "assistant", content: missingAIChatResponse,
    });
  });

  it.each([
    ["GET", "/api/ai/history", undefined],
    ["POST", "/api/ai/chat", { message: "Câu hỏi" }],
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

  it("does not store partial history when the OpenAI adapter fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.requestNutritionAnswer.mockRejectedValue(new Error("OpenAI unavailable"));
    expect(await request(app, "/api/ai/chat", {
      method: "POST", token: token(), body: { message: "Tôi nên ăn gì?" },
    })).toEqual({ status: 500, body: { message: "Máy chủ gặp lỗi. Vui lòng thử lại." } });
    expect(mocks.createMessages).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("Meal Plan AI compatibility", () => {
  it("keeps generatePlanWithAI(context) forwarding the same value", async () => {
    const context = { mealsPerDay: 3 };
    await expect(generatePlanWithAI(context)).resolves.toEqual({ summary: "Kế hoạch", days: [] });
    expect(mocks.requestMealPlan).toHaveBeenCalledWith(context);
  });
});
