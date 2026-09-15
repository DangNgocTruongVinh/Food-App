import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getProfileController, updateProfileController } from "./profile.controller.js";
import { updateProfileSchema } from "./profile.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(getProfileController));
router.put("/", validate(updateProfileSchema), asyncHandler(updateProfileController));

export default router;
