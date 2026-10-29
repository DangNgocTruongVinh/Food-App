import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { env } from "../../config/env.js";
import {
  mealPlanSystemPrompt, mealPlanUserPrompt, missingAIChatResponse,
  nutritionChatSystemPrompt, nutritionChatUserPrompt,
} from "./ai.prompts.js";
import { generatedPlanSchema, type GeneratedPlan } from "./ai.schema.js";

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
      });
      return response.output_parsed;
    },

    async answerNutritionQuestion(context: unknown, question: string) {
      if (!client) return missingAIChatResponse;
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: nutritionChatSystemPrompt },
          { role: "user", content: nutritionChatUserPrompt(context, question) },
        ],
      });
      return response.output_text;
    },
  };
}

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const openAIService = createOpenAIService(client, env.OPENAI_MODEL);

/** Chỉ cho biết đã cấu hình OpenAI hay chưa; không bao giờ trả về key. */
export const isAIConfigured = () => client !== null;
export const requestMealPlan = (context: unknown) => openAIService.generatePlan(context);
export const requestNutritionAnswer = (context: unknown, question: string) =>
  openAIService.answerNutritionQuestion(context, question);
