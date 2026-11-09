import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { queryKeys } from "../../api/query-keys";
import { getRecommendations, recommendationQueries } from "./recommendations.api";

const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe("Recommendations API", () => {
  it("sends the context and limit, and recipeId/pantryItemId only when set", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: { coldStart: false, items: [] }, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await getRecommendations({ context: "today", limit: 3 });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/recommendations", params: { context: "today", limit: 3 } });
    await getRecommendations({ context: "pantry", pantryItemId: "p1", limit: 6 });
    expect(adapter.mock.calls[1][0].params).toEqual({ context: "pantry", limit: 6, pantryItemId: "p1" });
    await getRecommendations({ context: "similar", recipeId: "r1", limit: 4 });
    expect(adapter.mock.calls[2][0].params).toEqual({ context: "similar", limit: 4, recipeId: "r1" });
  });

  it("keys every list under one prefix so pantry, meal and profile changes refresh all suggestions", () => {
    const key = recommendationQueries.list({ context: "for-you", limit: 3 }).queryKey;
    expect(key.slice(0, 1)).toEqual(queryKeys.recommendations.all);
  });
});
