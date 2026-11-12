import { createHmac, timingSafeEqual } from "node:crypto";

// Logic thuần của email nhắc đồ sắp hết hạn: chọn món, chống nhắc lại, token "Tắt nhắc", biểu thức lịch gửi.

const DAY_MS = 86_400_000;

export type PantryForReminder = { id: string; name: string; quantity: number; unit: string; expiryDate: Date | null };
export type ExpiringItem = PantryForReminder & { daysLeft: number; key: string };

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
/** Khóa một lần nhắc: id thực phẩm + ngày hết hạn (mua mới, đổi hạn thì là món "mới", được nhắc lại). */
export const reminderKey = (item: { id: string; expiryDate: Date }) => `${item.id}:${isoDay(item.expiryDate)}`;

/**
 * Món sắp hết hạn: còn 0..days ngày (theo ngày lịch; `today` = 00:00 UTC của ngày Việt Nam), số lượng > 0, chưa quá hạn.
 * Bản nhắc hằng ngày bỏ món đã nhắc (`reminded`), trừ khi hạn còn đúng 1 ngày. Hạn gần trước.
 */
export function pickExpiringItems(items: PantryForReminder[], days: number, today: Date, reminded: ReadonlySet<string> = new Set()) {
  const picked: ExpiringItem[] = [];
  for (const item of items) {
    if (!item.expiryDate || item.quantity <= 0) continue;
    const day = new Date(`${isoDay(item.expiryDate)}T00:00:00.000Z`);
    const daysLeft = Math.round((day.getTime() - today.getTime()) / DAY_MS);
    if (daysLeft < 0 || daysLeft > days) continue;
    const key = reminderKey({ id: item.id, expiryDate: day });
    if (reminded.has(key) && daysLeft !== 1) continue;
    picked.push({ ...item, daysLeft, key });
  }
  return picked.sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name, "vi"));
}

/** Token "Tắt nhắc" riêng cho từng người (HMAC, không hết hạn, chỉ dùng để tắt nhắc; không phải phiên đăng nhập). */
export function unsubscribeToken(userId: string, secret: string) {
  return createHmac("sha256", secret).update(`expiry-email-unsubscribe:${userId}`).digest("base64url");
}

export function isValidUnsubscribeToken(userId: string, token: string, secret: string) {
  const expected = Buffer.from(unsubscribeToken(userId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** "07:00" → biểu thức node-cron "0 7 * * *" (chạy theo múi giờ Asia/Ho_Chi_Minh). */
export function cronExpressionOf(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${minute} ${hour} * * *`;
}
