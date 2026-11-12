import { api } from "../../api/client";

// Báo cáo: GET /api/reports/waste (lãng phí theo tuần) và /api/reports/nutrition (dinh dưỡng 7 ngày từ bữa "Đã ăn").

export type WasteWeek = {
  start: string; discarded: number; used: number; usedBeforeExpiry: number; onTimeRate: number | null; wasteValue: number; pricedDiscards: number;
};
export type WasteCategory = { category: string; count: number; grams: number; milliliters: number; pieces: number };
export type Comparison<T> = { current: T; previous: T };
export type WasteReport = {
  weeks: WasteWeek[];
  totals: Omit<WasteWeek, "start">;
  byCategory: WasteCategory[];
  topCategory: string | null;
  comparison: { discarded: Comparison<number>; onTimeRate: Comparison<number | null>; wasteValue: Comparison<number> } | null;
  hasData: boolean;
};

export type NutritionDay = {
  date: string; status: "recorded" | "missing" | "future"; meals: number;
  calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null;
};
export type NutritionValues = { calories: number; proteinG: number; carbsG: number; fatG: number };
export type NutritionReport = {
  weekStart: string;
  targets: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null } | null;
  days: NutritionDay[];
  recordedDays: number;
  average: NutritionValues | null;
};

export async function getWasteReport(weeks: 4 | 8) {
  return (await api.get<WasteReport>("/reports/waste", { params: { weeks } })).data;
}

export async function getNutritionReport(week: "current" | "previous") {
  return (await api.get<NutritionReport>("/reports/nutrition", { params: { week } })).data;
}
