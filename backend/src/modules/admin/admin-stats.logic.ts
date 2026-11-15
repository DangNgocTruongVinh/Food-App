import { DAY_MS, vietnamWeekStart } from "../../utils/vietnam-date.js";
// Thống kê theo tuần theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7, không có giờ mùa hè), tuần bắt đầu thứ Hai.

export const STATS_WEEKS = 12;

/** Đầu tuần cũ nhất trong khoảng thống kê (tuần hiện tại tính là tuần thứ 12). */
export function statsRangeStart(now: Date, weeks = STATS_WEEKS) {
  return new Date(vietnamWeekStart(now).start.getTime() - (weeks - 1) * 7 * DAY_MS);
}

type SeriesInput = Record<string, Date[]>;

/** Đếm theo tuần, cũ trước mới sau; tuần không có dữ liệu điền 0. Dữ liệu ngoài khoảng bị bỏ qua. */
export function buildWeeklySeries<T extends SeriesInput>(now: Date, series: T, weeks = STATS_WEEKS) {
  const first = statsRangeStart(now, weeks);
  const rows = Array.from({ length: weeks }, (_, index) => {
    const key = vietnamWeekStart(new Date(first.getTime() + index * 7 * DAY_MS)).key;
    return { weekStart: key, ...Object.fromEntries(Object.keys(series).map((name) => [name, 0])) } as { weekStart: string } & Record<keyof T, number>;
  });
  const byKey = new Map(rows.map((row) => [row.weekStart, row]));
  for (const [name, dates] of Object.entries(series)) {
    for (const date of dates) {
      const row = byKey.get(vietnamWeekStart(date).key);
      if (row) (row as Record<string, number>)[name] += 1;
    }
  }
  return rows;
}
