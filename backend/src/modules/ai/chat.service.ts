import { prisma } from "../../lib/prisma.js";
import { answerNutritionQuestion } from "./ai.service.js";
import { CHAT_PLAN_DAYS, chatMealPlanContext, chatProfileContext, vietnamDateKey } from "./chat-context.js";

export function listChatHistory(userId: string) {
  return prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
}

/** Thực đơn đang áp dụng còn ngày từ hôm nay (giờ Việt Nam): chỉ lấy tên món, bữa, calo, đã ăn. */
function findActivePlanForChat(userId: string, now: Date) {
  const today = new Date(`${vietnamDateKey(now)}T00:00:00.000Z`);
  return prisma.mealPlan.findFirst({
    where: { userId, status: "ACTIVE", endDate: { gte: today } },
    orderBy: { startDate: "asc" },
    select: {
      name: true,
      days: {
        where: { date: { gte: today } },
        orderBy: { date: "asc" },
        take: CHAT_PLAN_DAYS,
        select: {
          date: true,
          items: { select: { mealType: true, calories: true, completed: true, recipe: { select: { name: true } } } },
        },
      },
    },
  });
}

export async function sendChatMessage(userId: string, message: string, now = new Date()) {
  const [profile, pantry, activePlan] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: { name: true, quantity: true, unit: true, expiryDate: true },
    }),
    findActivePlanForChat(userId, now),
  ]);
  const context = {
    profile: chatProfileContext(profile),
    pantry,
    mealPlan: chatMealPlanContext(activePlan, profile?.dailyCalorieTarget, now),
  };
  const answer = await answerNutritionQuestion(context, message);
  await prisma.chatMessage.createMany({ data: [
    { userId, role: "user", content: message },
    { userId, role: "assistant", content: answer },
  ] });
  return { answer };
}
