import type { FoodUnit, PantryRemovalReason, PantryTransactionSource } from "@prisma/client";
import { vietnamToday } from "../../utils/vietnam-date.js";

// Báo cáo (logic thuần): tuần bắt đầu Thứ Hai 00:00 giờ Việt Nam; lãng phí thực phẩm từ lịch sử kho; dinh dưỡng tuần từ bữa "Đã ăn".

const DAY_MS = 86_400_000;
const VIETNAM_OFFSET_MS = 7 * 3_600_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Một tuần: `start` là Thứ Hai (00:00 UTC của ngày lịch Việt Nam); [from, to) là khoảng thời điểm thật (Thứ Hai 00:00 giờ VN). */
export type Week = { start: Date; from: Date; to: Date };

export function vietnamWeekStart(now: Date) {
  const today = vietnamToday(now);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - sinceMonday * DAY_MS);
}

/** `count` tuần gần nhất, cũ → mới; tuần cuối là tuần hiện tại (chưa trọn). */
export function recentWeeks(now: Date, count: number): Week[] {
  const current = vietnamWeekStart(now);
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(current.getTime() - (count - 1 - index) * 7 * DAY_MS);
    const from = new Date(start.getTime() - VIETNAM_OFFSET_MS);
    return { start, from, to: new Date(from.getTime() + 7 * DAY_MS) };
  });
}

/** Ngày lịch Việt Nam (yyyy-MM-dd) của một thời điểm. */
const vietnamDayKey = (instant: Date) => isoDay(new Date(instant.getTime() + VIETNAM_OFFSET_MS));

export type WasteRow = {
  createdAt: Date; source: PantryTransactionSource; delta: number; quantityAfter: number; unit: FoodUnit;
  removalReason: PantryRemovalReason | null; category: string | null; expiryDate: Date | null; unitPrice: number | null;
  reversedAt: Date | null; reversalOfId: string | null;
};

/**
 * Phân loại một dòng lịch sử kho. "Bỏ đi": xóa với lý do Bỏ đi. "Dùng": trừ kho khi ăn, sửa về 0 ("Đã dùng hết"), hoặc xóa với lý do
 * Đã dùng hết khi còn hàng (xóa món đã về 0 thì lần dùng đã được tính trước đó). "Nhập nhầm", dòng đã hoàn tác, dòng hoàn tác: bỏ qua.
 */
export function classifyWaste(row: WasteRow): "discarded" | "used" | null {
  if (row.reversalOfId || row.reversedAt) return null;
  if (row.source === "MANUAL_DELETE") {
    if (row.removalReason === "DISCARDED") return "discarded";
    return row.removalReason === "USED_UP" && row.delta < 0 ? "used" : null;
  }
  if (row.source === "CONSUMPTION" && row.delta < 0) return "used";
  if (row.source === "MANUAL_EDIT" && row.delta < 0 && row.quantityAfter === 0) return "used";
  return null;
}

/** Dùng trước hạn: không có hạn, hoặc ngày dùng (giờ VN) không muộn hơn ngày hết hạn. */
const usedBeforeExpiry = (row: WasteRow) => !row.expiryDate || vietnamDayKey(row.createdAt) <= isoDay(row.expiryDate);

const rate = (part: number, whole: number) => (whole ? part / whole : null);

/** Quy lượng về g / ml / cái để cộng được giữa các đơn vị. */
function addAmount(target: { grams: number; milliliters: number; pieces: number }, quantity: number, unit: FoodUnit) {
  if (unit === "G") target.grams += quantity;
  else if (unit === "KG") target.grams += quantity * 1000;
  else if (unit === "ML") target.milliliters += quantity;
  else if (unit === "L") target.milliliters += quantity * 1000;
  else target.pieces += quantity;
}

export function summarizeWaste(rows: WasteRow[], weeks: Week[]) {
  const perWeek = weeks.map((week) => ({
    start: isoDay(week.start), discarded: 0, used: 0, usedBeforeExpiry: 0, wasteValue: 0, pricedDiscards: 0, onTimeRate: null as number | null,
  }));
  const categories = new Map<string, { category: string; count: number; grams: number; milliliters: number; pieces: number }>();
  for (const row of rows) {
    const kind = classifyWaste(row);
    const index = weeks.findIndex((week) => row.createdAt >= week.from && row.createdAt < week.to);
    if (!kind || index < 0) continue;
    const week = perWeek[index];
    if (kind === "used") {
      week.used += 1;
      if (usedBeforeExpiry(row)) week.usedBeforeExpiry += 1;
      continue;
    }
    week.discarded += 1;
    const quantity = Math.abs(row.delta);
    if (row.unitPrice !== null) {
      week.pricedDiscards += 1;
      week.wasteValue += quantity * row.unitPrice;
    }
    const name = row.category ?? "Khác";
    const entry = categories.get(name) ?? { category: name, count: 0, grams: 0, milliliters: 0, pieces: 0 };
    entry.count += 1;
    addAmount(entry, quantity, row.unit);
    categories.set(name, entry);
  }
  for (const week of perWeek) {
    week.wasteValue = Math.round(week.wasteValue);
    week.onTimeRate = rate(week.usedBeforeExpiry, week.used + week.discarded);
  }
  const sum = (key: "discarded" | "used" | "usedBeforeExpiry" | "wasteValue" | "pricedDiscards") => perWeek.reduce((total, week) => total + week[key], 0);
  const totals = {
    discarded: sum("discarded"), used: sum("used"), usedBeforeExpiry: sum("usedBeforeExpiry"),
    wasteValue: sum("wasteValue"), pricedDiscards: sum("pricedDiscards"), onTimeRate: null as number | null,
  };
  totals.onTimeRate = rate(totals.usedBeforeExpiry, totals.used + totals.discarded);
  const byCategory = [...categories.values()].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "vi"));
  const [previous, current] = perWeek.slice(-2);
  return {
    weeks: perWeek,
    totals,
    byCategory,
    topCategory: byCategory[0]?.category ?? null,
    comparison: previous && current ? {
      discarded: { current: current.discarded, previous: previous.discarded },
      onTimeRate: { current: current.onTimeRate, previous: previous.onTimeRate },
      wasteValue: { current: current.wasteValue, previous: previous.wasteValue },
    } : null,
    hasData: totals.discarded + totals.used > 0,
  };
}

export type EatenItem = { date: Date; calories: number; servings: number; recipe: { proteinG: number; carbsG: number; fatG: number } };
export type NutritionTargets = { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null };

/**
 * Dinh dưỡng 7 ngày của tuần bắt đầu `weekStart` từ các bữa "Đã ăn" (calo đã lưu ở bữa; đạm/tinh bột/béo = món × khẩu phần, như Tổng quan).
 * Ngày không có bữa nào "Đã ăn" là "missing" (chưa ghi), không tính là 0; ngày sau hôm nay là "future". Trung bình chỉ trên ngày đã ghi.
 */
export function summarizeNutrition(items: EatenItem[], weekStart: Date, now: Date, targets: NutritionTargets | null) {
  const today = isoDay(vietnamToday(now));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = isoDay(new Date(weekStart.getTime() + index * DAY_MS));
    const eaten = items.filter((item) => isoDay(item.date) === date);
    const status = date > today ? "future" as const : eaten.length ? "recorded" as const : "missing" as const;
    const total = (pick: (item: EatenItem) => number) => Math.round(eaten.reduce((sum, item) => sum + pick(item), 0));
    return {
      date, status, meals: eaten.length,
      calories: status === "recorded" ? total((item) => item.calories) : null,
      proteinG: status === "recorded" ? total((item) => item.recipe.proteinG * item.servings) : null,
      carbsG: status === "recorded" ? total((item) => item.recipe.carbsG * item.servings) : null,
      fatG: status === "recorded" ? total((item) => item.recipe.fatG * item.servings) : null,
    };
  });
  const recorded = days.filter((day) => day.status === "recorded");
  const average = (key: "calories" | "proteinG" | "carbsG" | "fatG") => Math.round(recorded.reduce((sum, day) => sum + (day[key] ?? 0), 0) / recorded.length);
  return {
    weekStart: isoDay(weekStart),
    targets,
    days,
    recordedDays: recorded.length,
    average: recorded.length ? { calories: average("calories"), proteinG: average("proteinG"), carbsG: average("carbsG"), fatG: average("fatG") } : null,
  };
}
