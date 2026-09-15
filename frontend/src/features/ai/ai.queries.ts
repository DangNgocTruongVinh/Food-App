import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import { getAssistantDashboard, getChatHistory, sendChatMessage } from "./ai.api";

export const aiQueries = {
  history: () => queryOptions({ queryKey: queryKeys.ai.history, queryFn: getChatHistory }),
  dashboard: () => queryOptions({ queryKey: queryKeys.dashboard, queryFn: getAssistantDashboard }),
};

export const aiMutations = {
  chat: () => mutationOptions({ mutationFn: sendChatMessage }),
};

export function invalidateAIHistory(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.ai.history });
}
