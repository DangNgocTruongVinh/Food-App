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
export const updateMealCompletionSchema = z.object({
  body: z.object({ completed: z.boolean() }),
  params: idParams,
  query: empty,
});
export const updateShoppingPurchasedSchema = z.object({
  body: z.object({ purchased: z.boolean() }),
  params: idParams,
  query: empty,
});
export const deleteMealPlanSchema = z.object({ body: empty, params: idParams, query: empty });

export type MealPlanIdParams = z.infer<typeof idParams>;
export type GenerateMealPlanInput = z.infer<typeof generateMealPlanSchema>["body"];
export type UpdateMealPlanStatusInput = z.infer<typeof updateMealPlanStatusSchema>["body"];
export type UpdateMealCompletionInput = z.infer<typeof updateMealCompletionSchema>["body"];
export type UpdateShoppingPurchasedInput = z.infer<typeof updateShoppingPurchasedSchema>["body"];
