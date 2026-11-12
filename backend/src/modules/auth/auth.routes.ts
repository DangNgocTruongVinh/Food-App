import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  changePasswordController, forgotPasswordController, loginController, logoutController, refreshController, registerController,
  resetPasswordController,
} from "./auth.controller.js";
import {
  changePasswordSchema, emptySchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema,
} from "./auth.schema.js";
import { normalizeEmail } from "./password-reset.service.js";

const router = Router();

// Chống dò mật khẩu/spam đăng ký: đăng nhập và đăng ký dùng chung 20 lần/phút/IP.
export const credentialsLimit = rateLimit({ windowMs: 60_000, max: 20, message: "Bạn thử quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại." });

// Quên mật khẩu: 5 yêu cầu/giờ cho mỗi email và 5 yêu cầu/giờ cho mỗi IP (chống spam hộp thư người khác).
const FORGOT_LIMIT_MESSAGE = "Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 1 giờ.";
export const forgotIpLimit = rateLimit({ windowMs: 3_600_000, max: 5, message: FORGOT_LIMIT_MESSAGE });
export const forgotEmailLimit = rateLimit({
  windowMs: 3_600_000, max: 5, message: FORGOT_LIMIT_MESSAGE, keyOf: (req) => `email:${normalizeEmail(String(req.body.email))}`,
});

router.post("/register", credentialsLimit, validate(registerSchema), asyncHandler(registerController));
router.post("/login", credentialsLimit, validate(loginSchema), asyncHandler(loginController));
router.post("/refresh", validate(emptySchema), asyncHandler(refreshController));
router.post("/logout", validate(emptySchema), asyncHandler(logoutController));
router.post("/forgot-password", forgotIpLimit, validate(forgotPasswordSchema), forgotEmailLimit, asyncHandler(forgotPasswordController));
router.post("/reset-password", credentialsLimit, validate(resetPasswordSchema), asyncHandler(resetPasswordController));
router.post("/change-password", requireAuth, validate(changePasswordSchema), asyncHandler(changePasswordController));

export default router;
