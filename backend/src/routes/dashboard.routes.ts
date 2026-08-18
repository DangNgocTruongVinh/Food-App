import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000);
  const [profile, pantryCount, expiringItems, activePlan] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.count({ where: { userId, quantity: { gt: 0 } } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 }, expiryDate: { gte: now, lte: inSevenDays } }, orderBy: { expiryDate: "asc" }, take: 5 }),
    prisma.mealPlan.findFirst({ where: { userId, status: "ACTIVE", startDate: { lte: inSevenDays }, endDate: { gte: now } }, include: { days: { include: { items: true } } }, orderBy: { startDate: "desc" } }),
  ]);
  const mealItems = activePlan?.days.flatMap((day) => day.items) ?? [];
  res.json({
    nutritionTargets: profile ? { calories: profile.dailyCalorieTarget, proteinG: profile.proteinTargetG, carbsG: profile.carbTargetG, fatG: profile.fatTargetG } : null,
    pantryCount,
    expiringItems,
    activePlan: activePlan ? { id: activePlan.id, name: activePlan.name, completionRate: mealItems.length ? Math.round(mealItems.filter((item) => item.completed).length / mealItems.length * 100) : 0 } : null,
  });
}));

export default router;
