import { api } from "../../api/client";
import type { ConsumptionPreview, FoodUnit, MealCompletionResult, MealPlan, MealPlanStatus, ShoppingItem } from "../../types";

export type MealConsumption = { mode: "deduct"; lines: Array<{ ingredientId: string; quantity: number; unit: FoodUnit }> } | { mode: "none" };
export interface MealCompletionUpdate { id: string; completed: boolean; consumption?: MealConsumption }
export interface ShoppingPurchasedUpdate { id: string; purchased: boolean }
export interface MealPlanStatusUpdate { id: string; status: MealPlanStatus }

export async function listMealPlans() {
  return (await api.get<MealPlan[]>("/meal-plans")).data;
}

export async function getMealPlan(id: string) {
  return (await api.get<MealPlan>(`/meal-plans/${id}`)).data;
}

export async function generateMealPlan(startDate: string) {
  return (await api.post<MealPlan>("/meal-plans/generate", { startDate })).data;
}

export async function updateMealPlanStatus({ id, status }: MealPlanStatusUpdate) {
  return (await api.patch<MealPlan>(`/meal-plans/${id}/status`, { status })).data;
}

export async function updateMealCompletion({ id, completed, consumption }: MealCompletionUpdate) {
  return (await api.patch<MealCompletionResult>(`/meal-plans/items/${id}`, consumption ? { completed, consumption } : { completed })).data;
}

/** Xem trước trừ kho cho một bữa (không đổi kho). */
export async function getConsumptionPreview(id: string) {
  return (await api.get<ConsumptionPreview>(`/meal-plans/items/${id}/consumption-preview`)).data;
}

export async function updateShoppingPurchased({ id, purchased }: ShoppingPurchasedUpdate) {
  return (await api.patch<ShoppingItem>(`/meal-plans/shopping/${id}`, { purchased })).data;
}

export async function deleteMealPlan(id: string) {
  await api.delete(`/meal-plans/${id}`);
}
