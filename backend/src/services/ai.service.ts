import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../config/env.js";

const MealChoice = z.object({
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  recipeId: z.string(),
  servings: z.number().min(0.5).max(4),
  reason: z.string(),
});

const GeneratedPlan = z.object({
  summary: z.string(),
  days: z.array(z.object({ dayIndex: z.number().int().min(0).max(6), meals: z.array(MealChoice) })),
});

const client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;

export type GeneratedPlan = z.infer<typeof GeneratedPlan>;

export async function generatePlanWithAI(context: unknown): Promise<GeneratedPlan | null> {
  if (!client) return null;
  const response = await client.responses.parse({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [
          "Bạn là chuyên gia lập thực đơn dinh dưỡng phổ thông cho ứng dụng NutriPlan AI.",
          "Chỉ chọn recipeId có trong danh sách. Tuyệt đối tránh dị ứng và món người dùng không thích.",
          "Ưu tiên nguyên liệu sẵn có, đặc biệt món sắp hết hạn, đồng thời đa dạng món trong 7 ngày.",
          "Mỗi ngày đủ số bữa yêu cầu và tổng năng lượng gần mục tiêu trong sai số 15%.",
          "Không chẩn đoán hoặc điều trị bệnh. Viết lý do ngắn gọn bằng tiếng Việt.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify(context) },
    ],
    text: { format: zodTextFormat(GeneratedPlan, "weekly_meal_plan") },
  });
  return response.output_parsed;
}

export async function answerNutritionQuestion(context: unknown, question: string) {
  if (!client) {
    return "AI chưa được cấu hình. Bạn vẫn có thể dùng chức năng lập thực đơn theo quy tắc. Hãy thêm OPENAI_API_KEY ở backend để bật trợ lý dinh dưỡng.";
  }
  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: "Bạn là trợ lý dinh dưỡng NutriPlan AI. Trả lời ngắn gọn bằng tiếng Việt, dựa trên hồ sơ và thực phẩm được cung cấp. Không chẩn đoán bệnh; với vấn đề y khoa, khuyên người dùng gặp chuyên gia.",
      },
      { role: "user", content: `Ngữ cảnh: ${JSON.stringify(context)}\n\nCâu hỏi: ${question}` },
    ],
  });
  return response.output_text;
}
