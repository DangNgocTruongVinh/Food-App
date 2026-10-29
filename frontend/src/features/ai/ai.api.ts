import { api } from "../../api/client";
import type { ChatMessage, DashboardData } from "../../types";

export interface ChatResponse { answer: string }
/** Backend chỉ cho biết đã cấu hình OpenAI hay chưa. */
export interface AIStatus { available: boolean }

export async function getAIStatus() {
  return (await api.get<AIStatus>("/ai/status")).data;
}

export async function getChatHistory() {
  return (await api.get<ChatMessage[]>("/ai/history")).data;
}

export async function getAssistantDashboard() {
  return (await api.get<DashboardData>("/dashboard")).data;
}

export async function sendChatMessage(message: string) {
  return (await api.post<ChatResponse>("/ai/chat", { message })).data;
}
