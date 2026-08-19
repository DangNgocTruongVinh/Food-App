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
  const [profile, pantryCount, expiringItems, expiredCount, activePlan, recommendedRecipes] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.count({ where: { userId, quantity: { gt: 0 } } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 }, expiryDate: { gte: now, lte: inSevenDays } }, orderBy: { expiryDate: "asc" }, take: 5 }),
    prisma.pantryItem.count({ where: { userId, quantity: { gt: 0 }, expiryDate: { lt: now } } }),
    prisma.mealPlan.findFirst({ where: { userId, status: "ACTIVE", startDate: { lte: inSevenDays }, endDate: { gte: now } }, include: { days: { include: { items: { include: { recipe: true } } } } }, orderBy: { startDate: "desc" } }),
    prisma.recipe.findMany({ orderBy: { createdAt: "asc" }, take: 3, select: { id: true, name: true, calories: true, prepMinutes: true, cookMinutes: true, dietTags: true } }),
  ]);
  const mealItems = activePlan?.days.flatMap((day) => day.items) ?? [];
  const todayKey = now.toISOString().slice(0, 10);
  const todayMeals = activePlan?.days.find((day) => day.date.toISOString().slice(0, 10) === todayKey)?.items ?? [];
  res.json({
    nutritionTargets: profile ? { calories: profile.dailyCalorieTarget, proteinG: profile.proteinTargetG, carbsG: profile.carbTargetG, fatG: profile.fatTargetG } : null,
    pantryCount,
    expiringItems,
    expiredCount,
    recommendedRecipes,
    activePlan: activePlan ? { id: activePlan.id, name: activePlan.name, completionRate: mealItems.length ? Math.round(mealItems.filter((item) => item.completed).length / mealItems.length * 100) : 0 } : null,
    todayMeals: todayMeals.map((item) => ({
      id: item.id,
      mealType: item.mealType,
      calories: item.calories,
      completed: item.completed,
      recipe: { id: item.recipe.id, name: item.recipe.name, prepMinutes: item.recipe.prepMinutes, cookMinutes: item.recipe.cookMinutes },
    })),
  });
}));

export default router;
