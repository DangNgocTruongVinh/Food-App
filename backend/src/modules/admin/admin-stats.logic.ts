// Thống kê theo tuần theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7, không có giờ mùa hè), tuần bắt đầu thứ Hai.

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const STATS_WEEKS = 12;

/** Thứ Hai 00:00 giờ Việt Nam của tuần chứa `instant`: trả về ngày (yyyy-MM-dd) và thời điểm UTC tương ứng. */
export function vietnamWeekStart(instant: Date) {
  const local = new Date(instant.getTime() + VIETNAM_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - daysSinceMonday * DAY_MS;
  return { key: new Date(mondayLocal).toISOString().slice(0, 10), start: new Date(mondayLocal - VIETNAM_OFFSET_MS) };
}

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
