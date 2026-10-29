import { isAIConfigured, requestMealPlan, requestNutritionAnswer } from "./openai.service.js";

export type { GeneratedPlan } from "./ai.schema.js";

export function generatePlanWithAI(context: unknown) {
  return requestMealPlan(context);
}

export function getAIStatus() {
  return { available: isAIConfigured() };
}

export function answerNutritionQuestion(context: unknown, question: string) {
  return requestNutritionAnswer(context, question);
}
