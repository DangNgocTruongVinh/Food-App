import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { loginController, registerController } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", validate(registerSchema), asyncHandler(registerController));
router.post("/login", validate(loginSchema), asyncHandler(loginController));

export default router;
