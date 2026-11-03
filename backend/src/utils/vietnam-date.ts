/** Ngày hôm nay theo giờ Việt Nam, dạng 00:00 UTC (cùng quy ước ngày của API kho: "yyyy-MM-dd" → T00:00:00.000Z). */
export function vietnamToday(now = new Date()) {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
