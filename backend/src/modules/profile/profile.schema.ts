import { z } from "zod";
import { PROFILE_LIMITS as L } from "../../shared/limits.js";

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(L.name.min).max(L.name.max).optional(),
    age: z.number().int().min(L.age.min).max(L.age.max).nullable().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
    heightCm: z.number().min(L.heightCm.min).max(L.heightCm.max).nullable().optional(),
    weightKg: z.number().min(L.weightKg.min).max(L.weightKg.max).nullable().optional(),
    targetWeightKg: z.number().min(L.weightKg.min).max(L.weightKg.max).nullable().optional(),
    activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]).optional(),
    goal: z.enum(["LOSE_WEIGHT", "MAINTAIN", "GAIN_WEIGHT", "BUILD_MUSCLE"]).optional(),
    dietType: z.enum(["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"]).optional(),
    allergies: z.array(z.string().max(L.listItemMax)).max(L.allergies).optional(),
    dislikedFoods: z.array(z.string().max(L.listItemMax)).max(L.dislikedFoods).optional(),
    preferredCuisines: z.array(z.string().max(L.listItemMax)).max(L.preferredCuisines).optional(),
    mealsPerDay: z.number().int().min(3).max(4).optional(),
    expiryEmailEnabled: z.boolean().optional(),
    expiryEmailDays: z.number().int().min(1).max(3).optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
