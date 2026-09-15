import { z } from "zod";

export const updateProfileSchema = z.object({
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
  params: z.object({}),
  query: z.object({}),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
