import { prisma } from "../../lib/prisma.js";
import { answerNutritionQuestion } from "./ai.service.js";

export function listChatHistory(userId: string) {
  return prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
}

export async function sendChatMessage(userId: string, message: string) {
  const [profile, pantry] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: { name: true, quantity: true, unit: true, expiryDate: true },
    }),
  ]);
  const answer = await answerNutritionQuestion({ profile, pantry }, message);
  await prisma.chatMessage.createMany({ data: [
    { userId, role: "user", content: message },
    { userId, role: "assistant", content: answer },
  ] });
  return { answer };
}
