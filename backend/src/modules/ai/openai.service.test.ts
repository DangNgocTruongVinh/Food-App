import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  mealPlanSystemPrompt, mealPlanUserPrompt, missingAIChatResponse,
  nutritionChatSystemPrompt, nutritionChatUserPrompt,
} from "./ai.prompts.js";
import { generatedPlanSchema } from "./ai.schema.js";
import { createOpenAIService } from "./openai.service.js";

vi.mock("../../config/env.js", () => ({
  env: { OPENAI_API_KEY: undefined, OPENAI_MODEL: "gpt-5-mini" },
}));

const generatedPlan = {
  summary: "Thực đơn cân bằng",
  days: [{
    dayIndex: 0,
    meals: [{ mealType: "BREAKFAST" as const, recipeId: "recipe-a", servings: 1, reason: "Phù hợp mục tiêu" }],
  }],
};

function mockedOpenAI() {
  const parse = vi.fn().mockResolvedValue({ output_parsed: generatedPlan });
  const create = vi.fn().mockResolvedValue({ output_text: "Câu trả lời dinh dưỡng" });
  return {
    client: { responses: { parse, create } } as unknown as OpenAI,
    parse,
    create,
  };
}

describe("OpenAI adapter (mocked; no external requests)", () => {
  it("preserves the exact V1 prompt and fallback copy", () => {
    expect(mealPlanSystemPrompt).toBe([
      "Bạn là chuyên gia lập thực đơn dinh dưỡng phổ thông cho ứng dụng NOURI AI.",
      "Chỉ chọn recipeId có trong danh sách. Tuyệt đối tránh dị ứng và món người dùng không thích.",
      "Ưu tiên nguyên liệu sẵn có, đặc biệt món sắp hết hạn, đồng thời đa dạng món trong 7 ngày.",
      "Mỗi ngày đủ số bữa yêu cầu và tổng năng lượng gần mục tiêu trong sai số 15%.",
      "Không chẩn đoán hoặc điều trị bệnh. Viết lý do ngắn gọn bằng tiếng Việt.",
    ].join(" "));
    expect(nutritionChatSystemPrompt).toBe("Bạn là trợ lý dinh dưỡng NOURI AI. Trả lời ngắn gọn bằng tiếng Việt, dựa trên hồ sơ và thực phẩm được cung cấp. Không chẩn đoán bệnh; với vấn đề y khoa, khuyên người dùng gặp chuyên gia.");
    expect(missingAIChatResponse).toBe("AI chưa được cấu hình. Bạn vẫn có thể dùng chức năng lập thực đơn theo quy tắc. Hãy thêm OPENAI_API_KEY ở backend để bật trợ lý dinh dưỡng.");
  });

  it("uses the unchanged model, meal-plan prompts and structured output parser", async () => {
    const mock = mockedOpenAI();
    const service = createOpenAIService(mock.client, "gpt-5-mini");
    const context = { mealsPerDay: 3, recipes: [{ id: "recipe-a" }] };
    await expect(service.generatePlan(context)).resolves.toEqual(generatedPlan);
    expect(mock.parse).toHaveBeenCalledTimes(1);
    expect(mock.parse.mock.calls[0][0]).toMatchObject({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: mealPlanSystemPrompt },
        { role: "user", content: mealPlanUserPrompt(context) },
      ],
      text: { format: expect.any(Object) },
    });
  });

  it("uses the unchanged model and chat prompts", async () => {
    const mock = mockedOpenAI();
    const service = createOpenAIService(mock.client, "gpt-5-mini");
    const context = { profile: { dietType: "BALANCED" }, pantry: [] };
    await expect(service.answerNutritionQuestion(context, "Tôi nên ăn gì?")).resolves.toBe("Câu trả lời dinh dưỡng");
    expect(mock.create).toHaveBeenCalledWith({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: nutritionChatSystemPrompt },
        { role: "user", content: nutritionChatUserPrompt(context, "Tôi nên ăn gì?") },
      ],
    });
  });

  it("preserves both no-key fallbacks without touching OpenAI", async () => {
    const service = createOpenAIService(null, "gpt-5-mini");
    await expect(service.generatePlan({})).resolves.toBeNull();
    await expect(service.answerNutritionQuestion({}, "Câu hỏi")).resolves.toBe(missingAIChatResponse);
  });

  it("propagates OpenAI errors to the shared HTTP error boundary", async () => {
    const mock = mockedOpenAI();
    const failure = new Error("OpenAI unavailable");
    mock.parse.mockRejectedValue(failure);
    mock.create.mockRejectedValue(failure);
    const service = createOpenAIService(mock.client, "gpt-5-mini");
    await expect(service.generatePlan({})).rejects.toBe(failure);
    await expect(service.answerNutritionQuestion({}, "Câu hỏi")).rejects.toBe(failure);
  });
});

describe("Generated meal-plan output schema", () => {
  it("accepts the same structured output contract", () => {
    expect(generatedPlanSchema.parse(generatedPlan)).toEqual(generatedPlan);
  });

  it.each([
    { ...generatedPlan, days: [{ ...generatedPlan.days[0], dayIndex: 7 }] },
    { ...generatedPlan, days: [{ ...generatedPlan.days[0], meals: [{ ...generatedPlan.days[0].meals[0], servings: 0.25 }] }] },
    { ...generatedPlan, days: [{ ...generatedPlan.days[0], meals: [{ ...generatedPlan.days[0].meals[0], mealType: "BRUNCH" }] }] },
  ])("rejects invalid structured output %#", (output) => {
    expect(generatedPlanSchema.safeParse(output).success).toBe(false);
  });
});
