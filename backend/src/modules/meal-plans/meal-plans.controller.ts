import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type {
  AddMealPlanItemInput, GenerateMealPlanInput, MealPlanIdParams, UpdateMealCompletionInput,
  UpdateMealPlanStatusInput, UpdateShoppingPurchasedInput,
} from "./meal-plans.schema.js";
import { previewMealConsumption, updateMealCompletion } from "./meal-consumption.service.js";
import {
  deleteMealPlan, generateWeeklyPlan, getMealPlan, listMealPlans, updateMealPlanStatus,
} from "./meal-plans.service.js";
import { swapMealItem } from "./meal-swap.service.js";
import { currentMealPlanJob, startMealPlanJob } from "./meal-plan-jobs.js";
import { addMealPlanItem, deleteMealPlanItem } from "./meal-plan-items.service.js";
import { updateShoppingPurchased } from "./shopping-purchase.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function listMealPlansController(req: Request, res: Response) {
  res.json(await listMealPlans(authenticatedUserId(req)));
}

export async function getMealPlanController(
  req: ValidatedRequest<unknown, MealPlanIdParams>,
  res: Response,
) {
  res.json(await getMealPlan(authenticatedUserId(req), req.params.id));
}

export async function generateMealPlanController(
  req: ValidatedRequest<GenerateMealPlanInput>,
  res: Response,
) {
  const userId = authenticatedUserId(req);
  if (req.body.mode === "ai") {
    res.status(202).json(startMealPlanJob(userId, req.body.startDate));
    return;
  }
  res.status(201).json(await generateWeeklyPlan(userId, req.body.startDate));
}

/** Việc "Tạo bằng AI" gần nhất của người dùng (đang chạy / xong / lỗi) hoặc null. */
export async function currentMealPlanJobController(req: Request, res: Response) {
  res.json(currentMealPlanJob(authenticatedUserId(req)));
}

export async function addMealPlanItemController(
  req: ValidatedRequest<AddMealPlanItemInput, MealPlanIdParams>,
  res: Response,
) {
  res.status(201).json(await addMealPlanItem(authenticatedUserId(req), req.params.id, req.body));
}

export async function deleteMealPlanItemController(
  req: ValidatedRequest<unknown, MealPlanIdParams>,
  res: Response,
) {
  res.json(await deleteMealPlanItem(authenticatedUserId(req), req.params.id));
}

export async function updateMealPlanStatusController(
  req: ValidatedRequest<UpdateMealPlanStatusInput, MealPlanIdParams>,
  res: Response,
) {
  res.json(await updateMealPlanStatus(authenticatedUserId(req), req.params.id, req.body.status));
}

export async function updateMealCompletionController(
  req: ValidatedRequest<UpdateMealCompletionInput, MealPlanIdParams>,
  res: Response,
) {
  res.json(await updateMealCompletion(authenticatedUserId(req), req.params.id, req.body.completed, req.body.consumption));
}

export async function mealConsumptionPreviewController(
  req: ValidatedRequest<unknown, MealPlanIdParams>,
  res: Response,
) {
  res.json(await previewMealConsumption(authenticatedUserId(req), req.params.id));
}

export async function swapMealItemController(
  req: ValidatedRequest<unknown, MealPlanIdParams>,
  res: Response,
) {
  res.json(await swapMealItem(authenticatedUserId(req), req.params.id));
}

export async function updateShoppingPurchasedController(
  req: ValidatedRequest<UpdateShoppingPurchasedInput, MealPlanIdParams>,
  res: Response,
) {
  res.json(await updateShoppingPurchased(authenticatedUserId(req), req.params.id, req.body.purchased));
}

export async function deleteMealPlanController(
  req: ValidatedRequest<unknown, MealPlanIdParams>,
  res: Response,
) {
  await deleteMealPlan(authenticatedUserId(req), req.params.id);
  res.status(204).send();
}
