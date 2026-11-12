import { api } from "../../api/client";
import type {
  AddMealPlanItemInput, ConsumptionPreview, FoodUnit, MealCompletionResult, MealPlan, MealPlanStatus, MealSwapResult, ShoppingPurchaseResult,
} from "../../types";

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

/** Vì sao "Tạo bằng AI" phải dùng bộ tạo thuật toán (backend PlanFallbackReason). */
export type PlanFallbackReason = "AI_NOT_CONFIGURED" | "AI_TIMEOUT" | "AI_ERROR" | "AI_INVALID";
/** Việc "Tạo bằng AI" chạy nền (backend meal-plan-jobs.ts). */
export interface MealPlanJob {
  id: string; status: "RUNNING" | "DONE" | "FAILED"; startDate: string; startedAt: string; finishedAt: string | null;
  planId: string | null; fallbackReason: PlanFallbackReason | null; error: string | null;
}

/** Mặc định: bộ tạo thuật toán, trả thực đơn ngay. */
export async function generateMealPlan(startDate: string) {
  return (await api.post<MealPlan>("/meal-plans/generate", { startDate })).data;
}

/** "Tạo bằng AI (1–2 phút)": backend trả ngay việc nền (202); hỏi trạng thái bằng getMealPlanJob. */
export async function startAIMealPlan(startDate: string) {
  return (await api.post<MealPlanJob>("/meal-plans/generate", { startDate, mode: "ai" })).data;
}

export async function getMealPlanJob() {
  return (await api.get<MealPlanJob | null>("/meal-plans/generate/current")).data;
}

export async function addMealPlanItem({ planId, dayId, mealType, recipeId, servings }: AddMealPlanItemInput) {
  return (await api.post<MealPlan>(`/meal-plans/${planId}/items`, { dayId, mealType, recipeId, servings })).data;
}

export async function deleteMealPlanItem(id: string) {
  return (await api.delete<MealPlan>(`/meal-plans/items/${id}`)).data;
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

/** Đổi món một bữa chưa ăn: server tự chọn món hợp hồ sơ hiện tại, cập nhật danh sách đi chợ (GĐ3b-R2). */
export async function swapMealItem(id: string) {
  return (await api.post<MealSwapResult>(`/meal-plans/items/${id}/swap`, {})).data;
}

export async function updateShoppingPurchased({ id, purchased }: ShoppingPurchasedUpdate) {
  return (await api.patch<ShoppingPurchaseResult>(`/meal-plans/shopping/${id}`, { purchased })).data;
}

export async function deleteMealPlan(id: string) {
  await api.delete(`/meal-plans/${id}`);
}
