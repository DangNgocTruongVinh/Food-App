/**
 * Ngày/tuần theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7, không có giờ mùa hè). Mọi nơi tính "hôm nay", "đầu tuần" theo giờ VN dùng
 * các hàm ở đây (Báo cáo, Thống kê Admin, trợ lý AI, giới hạn lượt trong ngày, kho, thông báo).
 */
export const DAY_MS = 86_400_000;
export const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** Ngày hôm nay theo giờ Việt Nam, dạng 00:00 UTC (cùng quy ước ngày của API kho: "yyyy-MM-dd" → T00:00:00.000Z). */
export function vietnamToday(now = new Date()) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Ngày lịch Việt Nam (yyyy-MM-dd) của một thời điểm; ngày trong thực đơn lưu 00:00 UTC của ngày lịch. */
export function vietnamDateKey(instant: Date) {
  return new Date(instant.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** Thời điểm thật 00:00 giờ Việt Nam của hôm nay (đếm lượt dùng trong ngày). */
export function vietnamDayStart(now: Date) {
  return new Date(vietnamToday(now).getTime() - VIETNAM_OFFSET_MS);
}

/**
 * Thứ Hai đầu tuần (giờ Việt Nam) chứa `instant`: `key` yyyy-MM-dd, `day` = 00:00 UTC của ngày lịch đó (quy ước ngày của Báo cáo),
 * `start` = thời điểm thật Thứ Hai 00:00 giờ VN. Báo cáo và Thống kê Admin dùng chung hàm này.
 */
export function vietnamWeekStart(instant: Date) {
  const local = new Date(instant.getTime() + VIETNAM_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - daysSinceMonday * DAY_MS;
  return { key: new Date(day).toISOString().slice(0, 10), day: new Date(day), start: new Date(day - VIETNAM_OFFSET_MS) };
}
