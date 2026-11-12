import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendTestExpiryEmail, unsubscribeExpiryEmail } from "./expiry-email.service.js";

// /api/expiry-email: "Gửi thử ngay" (cần đăng nhập) và "Tắt nhắc" từ email (không cần đăng nhập, kiểm token HMAC).
const empty = z.object({});
const testSchema = z.object({ body: empty, params: empty, query: empty });
const unsubscribeSchema = z.object({
  body: z.object({ userId: z.string().cuid(), token: z.string().min(10).max(100) }),
  params: empty,
  query: empty,
});

const unsubscribeLimit = rateLimit({ windowMs: 60_000, max: 20, message: "Bạn thử quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại." });

const router = Router();
router.post("/test", requireAuth, validate(testSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json(await sendTestExpiryEmail((req as AuthenticatedRequest).userId));
}));
router.post("/unsubscribe", unsubscribeLimit, validate(unsubscribeSchema), asyncHandler(
  async (req: ValidatedRequest<z.infer<typeof unsubscribeSchema>["body"]>, res: Response) => {
    res.json(await unsubscribeExpiryEmail(req.body.userId, req.body.token));
  },
));

export default router;
