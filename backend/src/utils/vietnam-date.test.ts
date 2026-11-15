import { describe, expect, it } from "vitest";
import { DAY_MS, vietnamDayStart, vietnamToday, vietnamWeekStart } from "./vietnam-date.js";

describe("vietnamWeekStart (Báo cáo và Thống kê Admin dùng chung)", () => {
  it("cho đúng kết quả như hai công thức cũ trên mọi giờ của 6 tuần (gồm ranh giới 00:00 giờ VN)", () => {
    // Công thức cũ của Báo cáo (theo ngày lịch VN qua Intl) và của Thống kê Admin (cộng 7 giờ).
    const reportsOld = (now: Date) => {
      const today = vietnamToday(now);
      return new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
    };
    const statsOldKey = (instant: Date) => {
      const local = new Date(instant.getTime() + 7 * 3_600_000);
      const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - ((local.getUTCDay() + 6) % 7) * DAY_MS;
      return new Date(monday).toISOString().slice(0, 10);
    };
    for (let t = Date.UTC(2026, 9, 25, 16, 59, 59, 999); t < Date.UTC(2026, 11, 6); t += 1_800_000) {
      const instant = new Date(t);
      const week = vietnamWeekStart(instant);
      expect(week.day).toEqual(reportsOld(instant));
      expect(week.key).toBe(statsOldKey(instant));
      expect(week.start.getTime()).toBe(week.day.getTime() - 7 * 3_600_000);
    }
  });

  it("00:00 giờ VN hôm nay là 17:00 UTC hôm trước", () => {
    expect(vietnamDayStart(new Date("2026-11-15T02:00:00.000Z"))).toEqual(new Date("2026-11-14T17:00:00.000Z"));
    expect(vietnamDayStart(new Date("2026-11-14T16:59:00.000Z"))).toEqual(new Date("2026-11-13T17:00:00.000Z"));
  });
});
