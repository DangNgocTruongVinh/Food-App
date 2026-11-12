import { prisma } from "../../lib/prisma.js";
import { recentWeeks, summarizeNutrition, summarizeWaste, vietnamWeekStart } from "./reports.logic.js";

const DAY_MS = 86_400_000;

/** GET /api/reports/waste?weeks=4|8: lãng phí thực phẩm theo tuần (giờ Việt Nam), chỉ dữ liệu của người dùng trong JWT. */
export async function getWasteReport(userId: string, weekCount: number, now = new Date()) {
  const weeks = recentWeeks(now, weekCount);
  const rows = await prisma.pantryTransaction.findMany({
    where: {
      userId, createdAt: { gte: weeks[0].from, lt: weeks.at(-1)!.to }, source: { in: ["CONSUMPTION", "MANUAL_EDIT", "MANUAL_DELETE"] },
    },
    select: {
      createdAt: true, source: true, delta: true, quantityAfter: true, unit: true, removalReason: true, category: true, expiryDate: true,
      unitPrice: true, reversedAt: true, reversalOfId: true,
    },
  });
  return summarizeWaste(rows, weeks);
}

/** GET /api/reports/nutrition?week=current|previous: bữa "Đã ăn" trong tuần so với mục tiêu hồ sơ. */
export async function getNutritionReport(userId: string, week: "current" | "previous", now = new Date()) {
  const start = new Date(vietnamWeekStart(now).getTime() - (week === "previous" ? 7 * DAY_MS : 0));
  const [items, profile] = await Promise.all([
    prisma.mealPlanItem.findMany({
      where: { completed: true, day: { date: { gte: start, lt: new Date(start.getTime() + 7 * DAY_MS) }, mealPlan: { userId } } },
      select: { calories: true, servings: true, recipe: { select: { proteinG: true, carbsG: true, fatG: true } }, day: { select: { date: true } } },
    }),
    prisma.nutritionProfile.findUnique({
      where: { userId }, select: { dailyCalorieTarget: true, proteinTargetG: true, carbTargetG: true, fatTargetG: true },
    }),
  ]);
  const targets = profile?.dailyCalorieTarget
    ? { calories: profile.dailyCalorieTarget, proteinG: profile.proteinTargetG, carbsG: profile.carbTargetG, fatG: profile.fatTargetG }
    : null;
  return summarizeNutrition(items.map((item) => ({ ...item, date: item.day.date })), start, now, targets);
}
