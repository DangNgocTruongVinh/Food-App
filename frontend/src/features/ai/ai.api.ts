import { api } from "../../api/client";
import type { ChatMessage, DashboardData } from "../../types";

export interface ChatResponse { answer: string }

export async function getChatHistory() {
  return (await api.get<ChatMessage[]>("/ai/history")).data;
}

export async function getAssistantDashboard() {
  return (await api.get<DashboardData>("/dashboard")).data;
}

export async function sendChatMessage(message: string) {
  return (await api.post<ChatResponse>("/ai/chat", { message })).data;
}
