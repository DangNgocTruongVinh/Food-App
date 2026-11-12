import cron from "node-cron";
import { env } from "../../config/env.js";
import { cronExpressionOf } from "./expiry-email.js";
import { runDailyExpiryEmails } from "./expiry-email.service.js";

/** Lịch gửi email nhắc hạn mỗi ngày lúc EXPIRY_EMAIL_TIME giờ Việt Nam (mặc định 07:00). Gọi một lần khi server khởi động. */
export function scheduleExpiryEmails() {
  const expression = cronExpressionOf(env.EXPIRY_EMAIL_TIME);
  console.log(`Nhắc hạn qua email: chạy mỗi ngày lúc ${env.EXPIRY_EMAIL_TIME} (Asia/Ho_Chi_Minh).`);
  return cron.schedule(expression, () => {
    void runDailyExpiryEmails().catch((error: unknown) => console.error("Nhắc hạn lỗi:", error instanceof Error ? error.message : error));
  }, { timezone: "Asia/Ho_Chi_Minh", name: "expiry-email" });
}
