import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { calculateNutritionTargets } from "../services/nutrition.service.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    age: z.number().int().min(13).max(120).nullable().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
    heightCm: z.number().min(100).max(250).nullable().optional(),
    weightKg: z.number().min(25).max(400).nullable().optional(),
    targetWeightKg: z.number().min(25).max(400).nullable().optional(),
    activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]).optional(),
    goal: z.enum(["LOSE_WEIGHT", "MAINTAIN", "GAIN_WEIGHT", "BUILD_MUSCLE"]).optional(),
    dietType: z.enum(["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"]).optional(),
    allergies: z.array(z.string().max(60)).max(30).optional(),
    dislikedFoods: z.array(z.string().max(60)).max(30).optional(),
    preferredCuisines: z.array(z.string().max(60)).max(20).optional(),
    mealsPerDay: z.number().int().min(3).max(4).optional(),
  }),
  params: z.object({}), query: z.object({}),
});

router.get("/", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, profile: true } });
  res.json(user);
}));

router.put("/", validate(profileSchema), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const { name, ...profileInput } = req.body;
  const targets = calculateNutritionTargets(profileInput);
  const [user, profile] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: name ? { name } : {}, select: { id: true, name: true, email: true } }),
    prisma.nutritionProfile.upsert({
      where: { userId },
      create: { userId, ...profileInput, dailyCalorieTarget: targets.calories, proteinTargetG: targets.proteinG, carbTargetG: targets.carbsG, fatTargetG: targets.fatG },
      update: { ...profileInput, dailyCalorieTarget: targets.calories, proteinTargetG: targets.proteinG, carbTargetG: targets.carbsG, fatTargetG: targets.fatG },
    }),
  ]);
  res.json({ ...user, profile });
}));

export default router;
