import { z } from "zod";

const empty = z.object({});
const idParams = z.object({ id: z.string().cuid() });

export const listMealPlansSchema = z.object({ body: empty, params: empty, query: empty });
export const getMealPlanSchema = z.object({ body: empty, params: idParams, query: empty });
export const generateMealPlanSchema = z.object({
  body: z.object({ startDate: z.string().date() }),
  params: empty,
  query: empty,
});
export const updateMealPlanStatusSchema = z.object({
  body: z.object({ status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]) }),
  params: idParams,
  query: empty,
});
const consumptionLine = z.object({
  ingredientId: z.string().cuid(),
  quantity: z.number().nonnegative().max(100_000),
  unit: z.enum(["G", "KG", "ML", "L", "ITEM", "PACKAGE"]),
});
// "Đã ăn" → trừ kho: deduct kèm lượng muốn trừ cho từng nguyên liệu (không có trong lines = không trừ); none = chỉ đánh dấu.
const mealConsumption = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("deduct"),
    lines: z.array(consumptionLine).max(60).refine(
      (lines) => new Set(lines.map((line) => line.ingredientId)).size === lines.length,
      "Mỗi nguyên liệu chỉ một dòng.",
    ),
  }),
  z.object({ mode: z.literal("none") }),
]);
export const updateMealCompletionSchema = z.object({
  body: z.object({ completed: z.boolean(), consumption: mealConsumption.optional() })
    .refine((body) => body.completed || !body.consumption, "Chỉ trừ kho khi đánh dấu đã ăn."),
  params: idParams,
  query: empty,
});
export const mealConsumptionPreviewSchema = z.object({ body: empty, params: idParams, query: empty });
// Đổi món: server tự chọn món thay theo hồ sơ, client không gửi món (không tin dữ liệu chọn món từ client).
export const swapMealItemSchema = z.object({ body: empty.strict(), params: idParams, query: empty });
export const updateShoppingPurchasedSchema = z.object({
  body: z.object({ purchased: z.boolean() }),
  params: idParams,
  query: empty,
});
export const deleteMealPlanSchema = z.object({ body: empty, params: idParams, query: empty });

export type MealPlanIdParams = z.infer<typeof idParams>;
export type GenerateMealPlanInput = z.infer<typeof generateMealPlanSchema>["body"];
export type UpdateMealPlanStatusInput = z.infer<typeof updateMealPlanStatusSchema>["body"];
export type MealConsumptionBody = z.infer<typeof mealConsumption>;
export type MealConsumptionInput = Extract<MealConsumptionBody, { mode: "deduct" }>;
export type UpdateMealCompletionInput = z.infer<typeof updateMealCompletionSchema>["body"];
export type UpdateShoppingPurchasedInput = z.infer<typeof updateShoppingPurchasedSchema>["body"];
