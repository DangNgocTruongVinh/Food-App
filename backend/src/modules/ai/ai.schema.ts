import { z } from "zod";

const empty = z.object({});

const mealChoiceSchema = z.object({
  mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
  recipeId: z.string(),
  servings: z.number().min(0.5).max(4),
  reason: z.string(),
});

export const generatedPlanSchema = z.object({
  summary: z.string(),
  days: z.array(z.object({
    dayIndex: z.number().int().min(0).max(6),
    meals: z.array(mealChoiceSchema),
  })),
});

export const listChatHistorySchema = z.object({ body: empty, params: empty, query: empty });
export const chatSchema = z.object({
  body: z.object({ message: z.string().min(2).max(1000) }),
  params: empty,
  query: empty,
});

export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;
export type ChatInput = z.infer<typeof chatSchema>["body"];
