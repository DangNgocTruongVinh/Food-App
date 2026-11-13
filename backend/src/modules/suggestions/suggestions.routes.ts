import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import type { AuthenticatedRequest } from "../../types/http.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { suggestFoodNames } from "./suggestions.service.js";

// /api/suggestions: gợi ý nhẹ cho ô nhập có danh sách (giao diện gọi sau khi ngừng gõ 150 ms). Cần đăng nhập; giới hạn
// 120 lần/phút cho mỗi người dùng (đếm theo userId từ JWT, không theo IP).
const foodSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({ q: z.string().trim().min(1).max(60) }),
});

export const suggestionLimit = rateLimit({
  windowMs: 60_000, max: 120, message: "Bạn gõ quá nhanh. Vui lòng đợi một chút rồi thử lại.",
  keyOf: (req) => (req as AuthenticatedRequest).userId,
});

const router = Router();
router.use(requireAuth, suggestionLimit);
router.get("/foods", validate(foodSchema), asyncHandler(async (req: Request, res: Response) => {
  // validate() không ghi đè req.query (Express 5 chỉ cho đọc) nên đọc lại giá trị đã kiểm tra.
  const { q } = foodSchema.shape.query.parse(req.query);
  res.json(await suggestFoodNames((req as AuthenticatedRequest).userId, q));
}));

export default router;
