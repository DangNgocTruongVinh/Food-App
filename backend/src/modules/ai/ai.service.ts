import { defaultReceiptProvider, receiptProviderOptions } from "../../services/receipt/ocr-providers.js";
import { isAIConfigured, requestMealPlan, requestNutritionAnswer, type ChatTurn } from "./openai.service.js";

export type { GeneratedPlan } from "./ai.schema.js";

export function generatePlanWithAI(context: unknown) {
  return requestMealPlan(context);
}

/** available: chat/thực đơn có OpenAI; receiptScan: quét hóa đơn đọc bằng gì ở chế độ "Tự động" (null = không quét được). */
export function getAIStatus() {
  const options = receiptProviderOptions();
  const has = (id: string) => options.some((option) => option.id === id && option.available);
  return { available: isAIConfigured(), receiptScan: { auto: defaultReceiptProvider(), openai: has("openai"), tesseract: has("tesseract") } };
}

export function answerNutritionQuestion(context: unknown, question: string, history: ChatTurn[] = []) {
  return requestNutritionAnswer(context, question, history);
}
