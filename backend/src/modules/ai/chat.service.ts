import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import { vietnamToday } from "../../utils/vietnam-date.js";
import { answerNutritionQuestion, getAIStatus } from "./ai.service.js";
import {
  answerAllergyWarnings, CHAT_HISTORY_TURNS, CHAT_PLAN_DAYS, chatHistoryTurns, chatMealPlanContext, chatPantryContext, chatProfileContext,
  chatSafetyContext, vietnamDateKey,
} from "./chat-context.js";

// Hỏi Nouri: không có key hoặc OpenAI lỗi → 503 kèm code để khung chat gợi ý "Gợi ý cho bạn" / "Nấu gì từ kho?"; không lưu tin.
export const AI_NOT_CONFIGURED = "Trợ lý AI chưa được bật trên máy chủ (chưa có OPENAI_API_KEY).";
export const AI_UNAVAILABLE = "Trợ lý AI đang gặp sự cố, vui lòng thử lại sau ít phút.";

async function profileAllergies(userId: string) {
  const profile = await prisma.nutritionProfile.findUnique({ where: { userId }, select: { allergies: true } });
  return profile?.allergies ?? [];
}

/** 50 tin gần nhất (cũ → mới); tin của trợ lý kèm allergyWarnings theo dị ứng hiện tại trong hồ sơ. */
export async function listChatHistory(userId: string) {
  const [messages, allergies] = await Promise.all([
    prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 50 }),
    profileAllergies(userId),
  ]);
  return messages.map((message) => ({
    ...message, allergyWarnings: message.role === "assistant" ? answerAllergyWarnings(message.content, allergies) : [],
  }));
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

/** Số câu hỏi đã gửi hôm nay (từ 00:00 giờ Việt Nam). */
function countQuestionsToday(userId: string, now: Date) {
  const dayStart = new Date(vietnamToday(now).getTime() - 7 * 3_600_000);
  return prisma.chatMessage.count({ where: { userId, role: "user", createdAt: { gte: dayStart } } });
}

export async function sendChatMessage(userId: string, message: string, now = new Date()) {
  if (!getAIStatus().available) throw new HttpError(503, AI_NOT_CONFIGURED, { code: "AI_NOT_CONFIGURED" });
  const limit = env.AI_CHAT_DAILY_LIMIT;
  if (await countQuestionsToday(userId, now) >= limit) {
    throw new HttpError(429, `Hôm nay bạn đã hỏi Nouri ${limit} câu, mức tối đa mỗi ngày. Hẹn bạn ngày mai nhé!`, { code: "AI_CHAT_LIMIT" });
  }
  const [profile, pantry, activePlan, recent] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({
      where: { userId, quantity: { gt: 0 } },
      select: { name: true, quantity: true, unit: true, expiryDate: true },
    }),
    findActivePlanForChat(userId, now),
    prisma.chatMessage.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take: CHAT_HISTORY_TURNS, select: { role: true, content: true },
    }),
  ]);
  const context = {
    profile: chatProfileContext(profile),
    safety: chatSafetyContext(profile),
    pantry: chatPantryContext(pantry, now),
    mealPlan: chatMealPlanContext(activePlan, profile?.dailyCalorieTarget, now),
  };
  let answer: string;
  try {
    answer = await answerNutritionQuestion(context, message, chatHistoryTurns(recent.reverse()));
  } catch (error) {
    console.error("Hỏi Nouri: OpenAI lỗi:", error instanceof Error ? error.message : error);
    throw new HttpError(503, AI_UNAVAILABLE, { code: "AI_UNAVAILABLE" });
  }
  await prisma.chatMessage.createMany({ data: [
    { userId, role: "user", content: message },
    { userId, role: "assistant", content: answer },
  ] });
  return { answer, allergyWarnings: answerAllergyWarnings(answer, profile?.allergies ?? []) };
}
