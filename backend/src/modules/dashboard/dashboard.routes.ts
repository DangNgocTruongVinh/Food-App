import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getDashboardController } from "./dashboard.controller.js";
import { getDashboardSchema } from "./dashboard.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(getDashboardSchema), asyncHandler(getDashboardController));

export default router;
