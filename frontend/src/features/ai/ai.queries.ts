import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import { getAIStatus, getAssistantDashboard, getChatHistory, sendChatMessage } from "./ai.api";

export const aiQueries = {
  history: () => queryOptions({ queryKey: queryKeys.ai.history, queryFn: getChatHistory }),
  // Cấu hình OpenAI ít khi đổi khi đang chạy.
  status: () => queryOptions({ queryKey: queryKeys.ai.status, queryFn: getAIStatus, staleTime: 5 * 60_000 }),
  dashboard: () => queryOptions({ queryKey: queryKeys.dashboard, queryFn: getAssistantDashboard }),
};

export const aiMutations = {
  chat: () => mutationOptions({ mutationFn: sendChatMessage }),
};

/** Trả Promise: gọi trong onSuccess thì mutation còn "đang chờ" tới khi lịch sử tải lại xong (tin vừa gửi không nháy mất). */
export function invalidateAIHistory(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.ai.history });
}
