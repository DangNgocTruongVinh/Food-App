import { queryOptions } from "@tanstack/react-query";
import { api } from "../../api/client";
import { retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { RecommendationContext, RecommendationResponse } from "../../types";

// Bộ gợi ý món (GĐ3b-R7): GET /api/recommendations theo ngữ cảnh. userId lấy từ token ở backend.

export type RecommendationParams = { context: RecommendationContext; recipeId?: string; pantryItemId?: string; limit: number };

export async function getRecommendations({ context, recipeId, pantryItemId, limit }: RecommendationParams) {
  const params = { context, limit, ...(recipeId ? { recipeId } : {}), ...(pantryItemId ? { pantryItemId } : {}) };
  return (await api.get<RecommendationResponse>("/recommendations", { params })).data;
}

export const recommendationQueries = {
  list: (params: RecommendationParams) => queryOptions({
    queryKey: queryKeys.recommendations.list(params),
    queryFn: () => getRecommendations(params),
    retry: retryUnlessClientError,
  }),
};
