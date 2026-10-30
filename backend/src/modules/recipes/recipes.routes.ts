import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  getRecipeController, getRecipeForYouController, getRecipeStatsController, listRecipesController,
} from "./recipes.controller.js";
import { getRecipeSchema, listRecipesSchema, recipeStatsSchema } from "./recipes.schema.js";

const router = Router();
// Công khai cho Landing (Guest): đặt trước requireAuth; chỉ trả số đếm theo nhóm.
router.get("/stats", validate(recipeStatsSchema), asyncHandler(getRecipeStatsController));
router.use(requireAuth);

router.get("/", validate(listRecipesSchema), asyncHandler(listRecipesController));
router.get("/:id", validate(getRecipeSchema), asyncHandler(getRecipeController));
router.get("/:id/for-you", validate(getRecipeSchema), asyncHandler(getRecipeForYouController));

export default router;
