import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { byUser, rateLimit } from "../../middleware/rate-limit.js";
import { USER_RATE_LIMITS } from "../../shared/limits.js";
import { validate } from "../../middleware/validate.js";
import type { AuthenticatedRequest } from "../../types/http.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { assertNoRunningMealPlanJob } from "./meal-plan-jobs.js";
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
// "Tạo bằng AI" (audit S3): giới hạn theo tài khoản, chỉ đếm mode "ai" (sau validate để có mode mặc định); bộ tạo thuật toán không giới hạn.
// Đang có việc chạy → 409 trước khi đếm: lần bị từ chối không làm mất lượt trong ngày.
const { aiMealPlans } = USER_RATE_LIMITS;
export const aiMealPlanLimit = rateLimit({ ...aiMealPlans, keyOf: byUser,
  message: `Bạn đã dùng hết ${aiMealPlans.max} lượt tạo thực đơn bằng AI trong ngày. Vui lòng thử lại sau, hoặc tạo bằng thuật toán.` });
const limitAiMode = (req: Request, res: Response, next: NextFunction) => {
  if (req.body?.mode !== "ai") return next();
  try {
    assertNoRunningMealPlanJob((req as AuthenticatedRequest).userId);
  } catch (error) {
    return next(error);
  }
  return aiMealPlanLimit(req, res, next);
};
router.post("/generate", validate(generateMealPlanSchema), limitAiMode, asyncHandler(generateMealPlanController));
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
