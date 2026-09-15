import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  deleteMealPlanController, generateMealPlanController, getMealPlanController,
  listMealPlansController, updateMealCompletionController, updateMealPlanStatusController,
  updateShoppingPurchasedController,
} from "./meal-plans.controller.js";
import {
  deleteMealPlanSchema, generateMealPlanSchema, getMealPlanSchema, listMealPlansSchema,
  updateMealCompletionSchema, updateMealPlanStatusSchema, updateShoppingPurchasedSchema,
} from "./meal-plans.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listMealPlansSchema), asyncHandler(listMealPlansController));
router.get("/:id", validate(getMealPlanSchema), asyncHandler(getMealPlanController));
router.post("/generate", validate(generateMealPlanSchema), asyncHandler(generateMealPlanController));
router.patch("/:id/status", validate(updateMealPlanStatusSchema), asyncHandler(updateMealPlanStatusController));
router.patch("/items/:id", validate(updateMealCompletionSchema), asyncHandler(updateMealCompletionController));
router.patch("/shopping/:id", validate(updateShoppingPurchasedSchema), asyncHandler(updateShoppingPurchasedController));
router.delete("/:id", validate(deleteMealPlanSchema), asyncHandler(deleteMealPlanController));

export default router;
