import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getRecommendationsController } from "./recommendation.controller.js";
import { recommendationsSchema } from "./recommendation.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(recommendationsSchema), asyncHandler(getRecommendationsController));

export default router;
