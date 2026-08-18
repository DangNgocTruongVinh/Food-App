import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { answerNutritionQuestion } from "../services/ai.service.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
router.use(requireAuth);

router.get("/history", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  res.json(await prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 50 }));
}));

router.post("/chat", validate(z.object({
  body: z.object({ message: z.string().min(2).max(1000) }), params: z.object({}), query: z.object({}),
})), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const [profile, pantry] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } }, select: { name: true, quantity: true, unit: true, expiryDate: true } }),
  ]);
  const answer = await answerNutritionQuestion({ profile, pantry }, req.body.message);
  await prisma.chatMessage.createMany({ data: [
    { userId, role: "user", content: req.body.message },
    { userId, role: "assistant", content: answer },
  ] });
  res.json({ answer });
}));

export default router;
