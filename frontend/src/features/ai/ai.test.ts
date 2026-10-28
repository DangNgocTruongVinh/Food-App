import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { ChatMessage, DashboardData } from "../../types";
import { getAssistantDashboard, getChatHistory, sendChatMessage } from "./ai.api";
import {
  assistantDietLabel, assistantFallbackHistory, assistantPromptPills, assistantQuickActions,
  assistantSuggestions, chatHistoryTime, normalizeChatMessage, recentUserHistory,
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

  it("keeps the existing diet labels and default", () => {
    expect(assistantDietLabel("BALANCED")).toBe("Ăn cân bằng");
    expect(assistantDietLabel("HIGH_PROTEIN")).toBe("Giàu protein");
    expect(assistantDietLabel("UNKNOWN")).toBe("Ăn lành mạnh");
    expect(assistantDietLabel()).toBe("Ăn lành mạnh");
  });

  it("preserves all visible suggestion, quick-action and fallback copy", () => {
    expect(assistantSuggestions).toHaveLength(3);
    expect(assistantQuickActions.map((item) => item.id)).toEqual(["meal", "plan", "pantry", "recipe"]);
    expect(assistantPromptPills).toEqual(["Món dưới 30 phút", "Món ít calo", "Tăng cơ, nhiều protein", "Ăn chay", "Giảm cân"]);
    expect(assistantFallbackHistory).toEqual(["Gợi ý bữa tối giàu protein", "Thực đơn giảm cân 3 ngày", "Dùng thực phẩm trong kho", "Giá trị dinh dưỡng của ức gà"]);
  });
});
