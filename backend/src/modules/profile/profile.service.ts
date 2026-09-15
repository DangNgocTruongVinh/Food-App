import { prisma } from "../../lib/prisma.js";
import { calculateNutritionTargets } from "../../services/nutrition.service.js";
import type { UpdateProfileInput } from "./profile.schema.js";

const publicUserSelect = { id: true, name: true, email: true } as const;

export async function getProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicUserSelect, profile: true },
  });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const { name, ...profileInput } = input;
  return prisma.$transaction(async (transaction) => {
    const currentProfile = await transaction.nutritionProfile.findUnique({ where: { userId } });
    const targets = calculateNutritionTargets({ ...currentProfile, ...profileInput });
    const nutritionTargets = {
      dailyCalorieTarget: targets.calories,
      proteinTargetG: targets.proteinG,
      carbTargetG: targets.carbsG,
      fatTargetG: targets.fatG,
    };
    const user = await transaction.user.update({
      where: { id: userId }, data: name ? { name } : {}, select: publicUserSelect,
    });
    const profile = await transaction.nutritionProfile.upsert({
      where: { userId },
      create: { userId, ...profileInput, ...nutritionTargets },
      update: { ...profileInput, ...nutritionTargets },
    });
    return { ...user, profile };
  });
}
