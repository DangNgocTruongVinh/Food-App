import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { env } from "../../config/env.js";
import {
  mealPlanSystemPrompt, mealPlanUserPrompt, missingAIChatResponse,
  nutritionChatSystemPrompt, nutritionChatUserPrompt,
} from "./ai.prompts.js";
import { generatedPlanSchema, type GeneratedPlan } from "./ai.schema.js";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export const CHAT_TIMEOUT_MS = 45_000;
// Tạo thực đơn 7 ngày: tối đa 120 giây (đo thực tế 80–90+ giây), không thử lại (nginx chờ 180 giây); quá hạn/lỗi thì dùng bộ tạo dự phòng.
// Trước đây không đặt: SDK chờ tới 10 phút và thử lại 2 lần, nginx trả 504 sau 60 giây dù thực đơn vẫn được tạo sau đó.
export const MEAL_PLAN_TIMEOUT_MS = 120_000;

export function createOpenAIService(client: OpenAI | null, model: string) {
  return {
    async generatePlan(context: unknown): Promise<GeneratedPlan | null> {
      if (!client) return null;
      const response = await client.responses.parse({
        model,
        input: [
          { role: "system", content: mealPlanSystemPrompt },
          { role: "user", content: mealPlanUserPrompt(context) },
        ],
        text: { format: zodTextFormat(generatedPlanSchema, "weekly_meal_plan") },
      }, { timeout: MEAL_PLAN_TIMEOUT_MS, maxRetries: 0 });
      return response.output_parsed;
    },

    /** history: vài tin gần nhất (đã cắt ngắn) để AI hiểu câu hỏi nối tiếp; câu hỏi hiện tại đi kèm ngữ cảnh. */
    async answerNutritionQuestion(context: unknown, question: string, history: ChatTurn[] = []) {
      if (!client) return missingAIChatResponse;
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: nutritionChatSystemPrompt },
          ...history,
          { role: "user", content: nutritionChatUserPrompt(context, question) },
        ],
      }, { timeout: CHAT_TIMEOUT_MS, maxRetries: 1 });
      return response.output_text;
    },
  };
}

/** Client dùng chung (chat, thực đơn, quét hóa đơn); null khi chưa cấu hình key. */
export const openAIClient = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const client = openAIClient;
const openAIService = createOpenAIService(client, env.OPENAI_MODEL);

/** Chỉ cho biết đã cấu hình OpenAI hay chưa; không bao giờ trả về key. */
export const isAIConfigured = () => client !== null;
export const requestMealPlan = (context: unknown) => openAIService.generatePlan(context);
export const requestNutritionAnswer = (context: unknown, question: string, history: ChatTurn[] = []) =>
  openAIService.answerNutritionQuestion(context, question, history);
