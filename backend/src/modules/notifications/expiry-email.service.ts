import { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { expiryReminderEmail } from "../../services/email-templates.js";
import { isEmailConfigured, sendMail } from "../../services/email.service.js";
import { HttpError } from "../../utils/http-error.js";
import { vietnamToday } from "../../utils/vietnam-date.js";
import { UNIT_LABEL } from "../pantry/pantry-history.service.js";
import { getRecommendations } from "../recommendation/recommendation.service.js";
import { isValidUnsubscribeToken, pickExpiringItems, unsubscribeToken } from "./expiry-email.js";

// Nhắc đồ sắp hết hạn qua email: lịch hằng ngày (expiry-email.scheduler.ts) và nút "Gửi thử ngay" trong Hồ sơ.
// Dòng ExpiryEmailLog được tạo trước khi gửi và là khóa chống gửi trùng (unique userId + ngày + slot).

export const TEST_SENDS_PER_DAY = 3;
const DAILY_SLOT = "daily";
const RECIPE_SUGGESTIONS = 3;

type Recipient = { userId: string; email: string; name: string; days: number };
export type SendResult = "SENT" | "NO_ITEMS" | "ALREADY_SENT";

const base = () => env.FRONTEND_URL.replace(/\/$/, "");
const dayKeyOf = (now: Date) => vietnamToday(now).toISOString().slice(0, 10);
const isUniqueConflict = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Các món đã nhắc trong bản hằng ngày gần đây (khóa id + hạn; quá 14 ngày thì món đó đã hết hạn từ lâu). */
async function remindedKeys(userId: string, now: Date) {
  const rows = await prisma.expiryEmailLog.findMany({
    where: { userId, slot: DAILY_SLOT, createdAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } }, select: { itemKeys: true },
  });
  return new Set(rows.flatMap((row) => row.itemKeys));
}

/** 3 món nên nấu từ bộ gợi ý ngữ cảnh kho (gọi hàm có sẵn); lỗi thì email vẫn gửi, chỉ không có phần món. */
async function suggestedRecipes(userId: string, now: Date) {
  try {
    const { items } = await getRecommendations(userId, { context: "pantry", limit: RECIPE_SUGGESTIONS }, now);
    return items.map((item) => ({ name: item.recipe.name, reason: item.reason, url: `${base()}/recipes/${item.recipe.id}` }));
  } catch (error) {
    console.warn("Nhắc hạn: chưa lấy được gợi ý món:", error instanceof Error ? error.message : error);
    return [];
  }
}

/** Chọn món, giữ khóa trong DB, gửi. `slot`: "daily" (bỏ món đã nhắc) hoặc "test-N" (lấy mọi món trong số ngày báo trước). */
async function sendReminder(recipient: Recipient, slot: string, now: Date, send = sendMail): Promise<SendResult> {
  const today = vietnamToday(now);
  const pantry = await prisma.pantryItem.findMany({
    where: { userId: recipient.userId, quantity: { gt: 0 }, expiryDate: { gte: today, lte: new Date(today.getTime() + (recipient.days + 1) * 86_400_000) } },
    select: { id: true, name: true, quantity: true, unit: true, expiryDate: true },
  });
  const reminded = slot === DAILY_SLOT ? await remindedKeys(recipient.userId, now) : new Set<string>();
  const items = pickExpiringItems(pantry, recipient.days, today, reminded);
  if (!items.length) return "NO_ITEMS";
  let log: { id: string };
  try {
    log = await prisma.expiryEmailLog.create({
      data: { userId: recipient.userId, dayKey: dayKeyOf(now), slot, itemKeys: items.map((item) => item.key) }, select: { id: true },
    });
  } catch (error) {
    if (isUniqueConflict(error)) return "ALREADY_SENT";
    throw error;
  }
  try {
    const recipes = await suggestedRecipes(recipient.userId, now);
    const lines = items.map((item) => ({
      name: item.name, daysLeft: item.daysLeft, quantity: `${item.quantity} ${UNIT_LABEL[item.unit as keyof typeof UNIT_LABEL] ?? item.unit}`,
    }));
    const links = {
      pantry: `${base()}/pantry`,
      unsubscribe: `${base()}/tat-nhac-han?u=${recipient.userId}&t=${unsubscribeToken(recipient.userId, env.JWT_SECRET)}`,
    };
    await send(expiryReminderEmail(recipient, lines, recipes, links));
    return "SENT";
  } catch (error) {
    // Gửi lỗi: bỏ khóa để lần chạy sau (hoặc "Gửi thử" lại) còn gửi được.
    await prisma.expiryEmailLog.delete({ where: { id: log.id } }).catch(() => undefined);
    throw error;
  }
}

/** Lịch hằng ngày: mọi người đã bật nhắc; bỏ qua (ghi log) khi chưa cấu hình SMTP hoặc tài khoản bị khóa. Một người lỗi không chặn người khác. */
export async function runDailyExpiryEmails(now = new Date(), send = sendMail) {
  const summary = { sent: 0, noItems: 0, alreadySent: 0, locked: 0, failed: 0 };
  if (!isEmailConfigured()) {
    console.info("Nhắc hạn: chưa cấu hình SMTP, bỏ qua lần gửi hôm nay.");
    return { ...summary, skipped: "NO_SMTP" as const };
  }
  const profiles = await prisma.nutritionProfile.findMany({
    where: { expiryEmailEnabled: true },
    select: { userId: true, expiryEmailDays: true, user: { select: { email: true, name: true, lockedAt: true } } },
  });
  for (const profile of profiles) {
    if (profile.user.lockedAt) {
      console.info(`Nhắc hạn: bỏ qua tài khoản bị khóa ${profile.userId}.`);
      summary.locked += 1;
      continue;
    }
    try {
      const result = await sendReminder({ userId: profile.userId, ...profile.user, days: profile.expiryEmailDays }, DAILY_SLOT, now, send);
      if (result === "SENT") summary.sent += 1;
      else if (result === "NO_ITEMS") summary.noItems += 1;
      else summary.alreadySent += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`Nhắc hạn: gửi cho ${profile.userId} lỗi:`, error instanceof Error ? error.message : error);
    }
  }
  console.info("Nhắc hạn xong:", JSON.stringify(summary));
  return summary;
}

/** POST /api/expiry-email/test: "Gửi thử ngay" (tối đa 3 lần/ngày), dùng số ngày báo trước trong hồ sơ, không cần bật nhắc. */
export async function sendTestExpiryEmail(userId: string, now = new Date(), send = sendMail) {
  const [user, profile, used] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    prisma.nutritionProfile.findUnique({ where: { userId }, select: { expiryEmailDays: true } }),
    prisma.expiryEmailLog.count({ where: { userId, dayKey: dayKeyOf(now), slot: { startsWith: "test-" } } }),
  ]);
  if (!user) throw new HttpError(404, "Không tìm thấy tài khoản.");
  if (used >= TEST_SENDS_PER_DAY) throw new HttpError(429, `Hôm nay bạn đã gửi thử ${TEST_SENDS_PER_DAY} lần. Thử lại vào ngày mai.`);
  const days = profile?.expiryEmailDays ?? 2;
  const result = await sendReminder({ userId, ...user, days }, `test-${used + 1}`, now, send);
  if (result === "NO_ITEMS") throw new HttpError(422, `Kho chưa có thực phẩm nào hết hạn trong ${days} ngày tới nên chưa có gì để nhắc.`);
  if (result === "ALREADY_SENT") throw new HttpError(409, "Đang gửi thử, vui lòng đợi một chút rồi thử lại.");
  return { sent: true, emailConfigured: isEmailConfigured(), remainingToday: TEST_SENDS_PER_DAY - used - 1 };
}

/** POST /api/expiry-email/unsubscribe: "Tắt nhắc" một chạm từ email, không cần đăng nhập (token HMAC riêng của người đó). */
export async function unsubscribeExpiryEmail(userId: string, token: string) {
  if (!isValidUnsubscribeToken(userId, token, env.JWT_SECRET)) throw new HttpError(400, "Liên kết tắt nhắc không hợp lệ.");
  await prisma.nutritionProfile.updateMany({ where: { userId }, data: { expiryEmailEnabled: false } });
  return { message: "Đã tắt email nhắc đồ sắp hết hạn. Bạn có thể bật lại trong Hồ sơ." };
}
