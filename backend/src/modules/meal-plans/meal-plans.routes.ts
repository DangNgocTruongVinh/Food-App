import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  addMealPlanItemController, deleteMealPlanController, deleteMealPlanItemController, generateMealPlanController, currentMealPlanJobController, getMealPlanController,
  listMealPlansController, mealConsumptionPreviewController, swapMealItemController, updateMealCompletionController, updateMealPlanStatusController,
  updateShoppingPurchasedController,
} from "./meal-plans.controller.js";
import {
  addMealPlanItemSchema, deleteMealPlanItemSchema, deleteMealPlanSchema, generateMealPlanSchema, getMealPlanSchema, listMealPlansSchema, mealConsumptionPreviewSchema, swapMealItemSchema,
  updateMealCompletionSchema, updateMealPlanStatusSchema, updateShoppingPurchasedSchema,
} from "./meal-plans.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listMealPlansSchema), asyncHandler(listMealPlansController));
router.get("/:id", validate(getMealPlanSchema), asyncHandler(getMealPlanController));
router.post("/generate", validate(generateMealPlanSchema), asyncHandler(generateMealPlanController));
router.get("/generate/current", validate(listMealPlansSchema), asyncHandler(currentMealPlanJobController));
router.post("/:id/items", validate(addMealPlanItemSchema), asyncHandler(addMealPlanItemController));
router.patch("/:id/status", validate(updateMealPlanStatusSchema), asyncHandler(updateMealPlanStatusController));
router.get("/items/:id/consumption-preview", validate(mealConsumptionPreviewSchema), asyncHandler(mealConsumptionPreviewController));
router.post("/items/:id/swap", validate(swapMealItemSchema), asyncHandler(swapMealItemController));
router.delete("/items/:id", validate(deleteMealPlanItemSchema), asyncHandler(deleteMealPlanItemController));
router.patch("/items/:id", validate(updateMealCompletionSchema), asyncHandler(updateMealCompletionController));
router.patch("/shopping/:id", validate(updateShoppingPurchasedSchema), asyncHandler(updateShoppingPurchasedController));
router.delete("/:id", validate(deleteMealPlanSchema), asyncHandler(deleteMealPlanController));

export default router;
