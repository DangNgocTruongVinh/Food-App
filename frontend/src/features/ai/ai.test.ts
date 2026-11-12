import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { ChatMessage, DashboardData } from "../../types";
import { getAIStatus, getAssistantDashboard, getChatHistory, sendChatMessage } from "./ai.api";
import {
  assistantDietLabel, assistantPromptSuggestions, chatHistoryTime, chatMessageTime, normalizeChatMessage, recentUserHistory,
  isNearChatBottom,
  isSubmitEnter,
  scrollChatToBottom,
} from "./ai.logic";
import { aiMutations, aiQueries, invalidateAIHistory } from "./ai.queries";

const messages: ChatMessage[] = [
  { id: "a", role: "user", content: "Câu hỏi cũ", createdAt: "2026-09-15T08:00:00.000Z" },
  { id: "b", role: "assistant", content: "Câu trả lời", createdAt: "2026-09-15T08:00:01.000Z" },
  { id: "c", role: "user", content: "Câu hỏi mới", createdAt: "2026-09-15T09:00:00.000Z" },
];
const dashboard: DashboardData = {
  nutritionTargets: { calories: 2000, proteinG: 100, carbsG: 250, fatG: 65 },
  pantryCount: 4, expiringItems: [], expiredCount: 0, activePlan: null,
  recommendedRecipes: [], todayMeals: [],
};
const originalAdapter = api.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = createAppQueryClient();
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("sessionStorage", { getItem: () => null });
});

afterEach(() => {
  client.clear();
  api.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
});

describe("AI frontend API adapters (no network)", () => {
  it("loads chat history through the existing endpoint", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: messages, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await getChatHistory()).toEqual(messages);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/ai/history" });
  });

  it("reads whether AI is configured from the status endpoint", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: { available: false }, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await getAIStatus()).toEqual({ available: false });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/ai/status" });
  });

  it("loads the unchanged Dashboard context used by the assistant page", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: dashboard, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await getAssistantDashboard()).toEqual(dashboard);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/dashboard" });
  });

  it("sends the unchanged trimmed message payload", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: { answer: "Bạn có thể ăn ức gà." }, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await sendChatMessage("Tôi nên ăn gì?")).toEqual({ answer: "Bạn có thể ăn ức gà." });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "post", url: "/ai/chat" });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ message: "Tôi nên ăn gì?" });
  });

  it.each(["history", "dashboard", "chat"] as const)("propagates a failed %s request", async (operation) => {
    const failure = new Error(`${operation} failed`);
    api.defaults.adapter = async () => { throw failure; };
    const actions = {
      history: () => getChatHistory(),
      dashboard: () => getAssistantDashboard(),
      chat: () => sendChatMessage("Câu hỏi"),
    };
    await expect(actions[operation]()).rejects.toBe(failure);
  });
});

describe("AI query and mutation definitions", () => {
  it("uses shared keys and caches chat history", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: messages, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(aiQueries.history().queryKey).toEqual(["ai", "history"]);
    expect(aiQueries.dashboard().queryKey).toEqual(["dashboard"]);
    expect(await client.fetchQuery(aiQueries.history())).toEqual(messages);
    expect(await client.fetchQuery(aiQueries.history())).toEqual(messages);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("invalidates only AI history after a chat response", () => {
    for (const key of [["ai"], ["ai", "history"], ["dashboard"], ["profile"]]) client.setQueryData(key, {});
    invalidateAIHistory(client);
    expect(client.getQueryState(queryKeys.ai.history)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.dashboard)?.isInvalidated).toBe(false);
    expect(client.getQueryState(queryKeys.profile)?.isInvalidated).toBe(false);
  });

  it("executes chat through the centralized mutation", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: { answer: "Câu trả lời" }, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await expect(new MutationObserver(client, aiMutations.chat()).mutate("Câu hỏi"))
      .resolves.toEqual({ answer: "Câu trả lời" });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "post", url: "/ai/chat" });
  });
});

describe("AI assistant page business logic", () => {
  it("trims submitted messages and blocks whitespace-only content", () => {
    expect(normalizeChatMessage("  Tôi nên ăn gì?  ")).toBe("Tôi nên ăn gì?");
    expect(normalizeChatMessage("   ")).toBeNull();
  });

  it("keeps only the latest four user messages in reverse order", () => {
    const extended = [
      ...messages,
      { id: "d", role: "user" as const, content: "Câu 3", createdAt: "" },
      { id: "e", role: "user" as const, content: "Câu 4", createdAt: "" },
      { id: "f", role: "user" as const, content: "Câu 5", createdAt: "" },
    ];
    expect(recentUserHistory(extended).map((item) => item.content)).toEqual(["Câu 5", "Câu 4", "Câu 3", "Câu hỏi mới"]);
  });

  it("returns every loaded user message, newest first, when expanded", () => {
    const extended = [...messages, { id: "d", role: "user" as const, content: "Câu 3", createdAt: "" }];
    const all = recentUserHistory(extended, null);
    expect(all.every((item) => item.role === "user")).toBe(true);
    expect(all[0].content).toBe("Câu 3");
    expect(all).toHaveLength(extended.filter((item) => item.role === "user").length);
  });

  it("formats chat history time from the real createdAt", () => {
    const now = new Date(2026, 9, 28, 15, 0);
    expect(chatHistoryTime(new Date(2026, 9, 28, 10, 23).toISOString(), now)).toBe("10:23");
    expect(chatHistoryTime(new Date(2026, 9, 27, 23, 59).toISOString(), now)).toBe("Hôm qua");
    expect(chatHistoryTime(new Date(2026, 9, 24, 8, 0).toISOString(), now)).toBe("4 ngày trước");
  });

  it("labels diets in Vietnamese only", () => {
    expect(assistantDietLabel("BALANCED")).toBe("Ăn cân bằng");
    expect(assistantDietLabel("LOW_CARB")).toBe("Ít tinh bột");
    expect(assistantDietLabel("HIGH_PROTEIN")).toBe("Giàu đạm");
    expect(assistantDietLabel("UNKNOWN")).toBe("Chưa chọn");
    expect(assistantDietLabel()).toBe("Chưa chọn");
  });

  it("shows the real message time, with the date for older days", () => {
    const now = new Date(2026, 9, 28, 15, 0);
    expect(chatMessageTime(new Date(2026, 9, 28, 9, 5).toISOString(), now)).toBe("09:05");
    expect(chatMessageTime(new Date(2026, 9, 26, 21, 40).toISOString(), now)).toBe("21:40, 26/10/2026");
  });

  it("builds question suggestions from real pantry and profile data", () => {
    const now = new Date(2026, 9, 28, 12, 0);
    const profile = { dietType: "VEGAN", allergies: [" Đậu phộng "], proteinTargetG: 90 } as Parameters<typeof assistantPromptSuggestions>[0]["profile"];
    const expiring = { id: "p1", name: "Ức gà", expiryDate: "2026-10-30T00:00:00.000Z" } as DashboardData["expiringItems"][number];
    expect(assistantPromptSuggestions({ profile, dashboard: { ...dashboard, expiringItems: [expiring] } }, now)).toEqual([
      "Nấu gì với ức gà (còn 2 ngày) cho bữa tối nay?",
      "Làm sao ăn đủ 90 g đạm hôm nay?",
      "Bữa sáng thuần chay nào đủ no trong 15 phút?",
      "Món nào thay thế được khi tôi dị ứng đậu phộng?",
    ]);
  });

  it("falls back to general questions without inventing data", () => {
    const suggestions = assistantPromptSuggestions({ profile: null, dashboard: undefined });
    expect(suggestions).toEqual(["Bữa tối dưới 500 kcal nên ăn gì?", "Gợi ý bữa sáng nhanh, nhiều đạm."]);
    expect(assistantPromptSuggestions({ profile: null, dashboard: { ...dashboard, nutritionTargets: null } })[0])
      .toBe("Từ những gì đang có trong kho, tôi nấu được món nào?");
  });
});

describe("Chat scrolling and Enter key", () => {
  const box = (scrollTop: number) => ({ scrollHeight: 1200, clientHeight: 400, scrollTop, scrollTo: vi.fn() });

  it("knows whether the reader is near the bottom of the chat window", () => {
    expect(isNearChatBottom(box(800))).toBe(true);
    expect(isNearChatBottom(box(760))).toBe(true);
    expect(isNearChatBottom(box(300))).toBe(false);
    expect(isNearChatBottom(null)).toBe(true);
  });

  it("scrolls only the chat window (never the page), smoothly after the first time", () => {
    const chatWindow = box(0);
    scrollChatToBottom(chatWindow, false);
    expect(chatWindow.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: "auto" });
    scrollChatToBottom(chatWindow, true);
    expect(chatWindow.scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: "smooth" });
    expect(() => scrollChatToBottom(null, true)).not.toThrow();
  });

  it("sends on Enter, keeps Shift+Enter for a new line and ignores Enter while a Vietnamese IME is composing", () => {
    expect(isSubmitEnter({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 13 })).toBe(true);
    expect(isSubmitEnter({ key: "Enter", shiftKey: true, isComposing: false, keyCode: 13 })).toBe(false);
    expect(isSubmitEnter({ key: "Enter", shiftKey: false, isComposing: true, keyCode: 13 })).toBe(false);
    expect(isSubmitEnter({ key: "Enter", shiftKey: false, isComposing: false, keyCode: 229 })).toBe(false);
    expect(isSubmitEnter({ key: "a", shiftKey: false, isComposing: false })).toBe(false);
  });
});

describe("Hỏi Nouri: cảnh báo dị ứng và phân loại lỗi", async () => {
  const { allergyWarningText, chatErrorKind } = await import("./ai.logic");

  it("cảnh báo nêu đúng thành phần; không có thì không cảnh báo", () => {
    expect(allergyWarningText(["tôm", "cá"])).toBe(
      "Câu trả lời có nhắc tới tôm, cá — bạn đã khai báo dị ứng. Đừng dùng gợi ý này nếu chưa kiểm tra kỹ.",
    );
    expect(allergyWarningText([])).toBeNull();
    expect(allergyWarningText(undefined)).toBeNull();
  });

  it("503 / chưa có key → gợi ý tính năng không cần AI; 429 → hết lượt; còn lại → lỗi thường", () => {
    expect(chatErrorKind(503, "AI_UNAVAILABLE")).toBe("unavailable");
    expect(chatErrorKind(503, undefined)).toBe("unavailable");
    expect(chatErrorKind(429, "AI_CHAT_LIMIT")).toBe("limit");
    expect(chatErrorKind(500, undefined)).toBe("other");
    expect(chatErrorKind(undefined, undefined)).toBe("other");
  });
});
