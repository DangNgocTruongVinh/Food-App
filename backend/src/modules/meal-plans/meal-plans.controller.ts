import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type {
  GenerateMealPlanInput, MealPlanIdParams, UpdateMealCompletionInput,
  UpdateMealPlanStatusInput, UpdateShoppingPurchasedInput,
} from "./meal-plans.schema.js";
import {
  deleteMealPlan, generateWeeklyPlan, getMealPlan, listMealPlans,
  updateMealCompletion, updateMealPlanStatus, updateShoppingPurchased,
} from "./meal-plans.service.js";

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
  res.status(201).json(await generateWeeklyPlan(authenticatedUserId(req), req.body.startDate));
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
  res.json(await updateMealCompletion(authenticatedUserId(req), req.params.id, req.body.completed));
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
