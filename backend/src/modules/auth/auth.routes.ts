import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  changePasswordController, loginController, logoutController, refreshController, registerController,
} from "./auth.controller.js";
import { changePasswordSchema, emptySchema, loginSchema, registerSchema } from "./auth.schema.js";

const router = Router();

// Chống dò mật khẩu/spam đăng ký: đăng nhập và đăng ký dùng chung 20 lần/phút/IP.
export const credentialsLimit = rateLimit({ windowMs: 60_000, max: 20, message: "Bạn thử quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại." });

router.post("/register", credentialsLimit, validate(registerSchema), asyncHandler(registerController));
router.post("/login", credentialsLimit, validate(loginSchema), asyncHandler(loginController));
router.post("/refresh", validate(emptySchema), asyncHandler(refreshController));
router.post("/logout", validate(emptySchema), asyncHandler(logoutController));
router.post("/change-password", requireAuth, validate(changePasswordSchema), asyncHandler(changePasswordController));

export default router;
