import type { Comparison, NutritionDay, WasteCategory } from "./reports.api";

// Logic thuần trang Báo cáo: định dạng số, so với tuần trước, lượng theo nhóm, tên ngày trong tuần.

const number = (value: number, digits = 0) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(value);

export const formatVnd = (value: number) => `${number(Math.round(value))} đ`;
export const formatPercent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)} %`);

/** "dd/MM" từ "yyyy-MM-dd" (ngày bắt đầu tuần, Thứ Hai). */
export function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

const WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
/** Tên ngày theo vị trí trong tuần (0 = Thứ Hai). */
export const weekdayName = (index: number) => WEEKDAYS[index] ?? "";

/**
 * So với tuần trước, nói đúng chiều tốt/xấu: `lowerIsBetter` cho số món bỏ đi và tiền lãng phí; tỉ lệ dùng trước hạn thì cao là tốt.
 * Thiếu số liệu tuần nào thì nói rõ.
 */
export function compareText(value: Comparison<number | null>, kind: "count" | "money" | "rate") {
  const { current, previous } = value;
  if (current === null || previous === null) return "Chưa đủ dữ liệu để so với tuần trước.";
  const diff = current - previous;
  if (Math.abs(diff) < (kind === "rate" ? 0.005 : 0.5)) return "Bằng tuần trước.";
  const better = kind === "rate" ? diff > 0 : diff < 0;
  const amount = kind === "rate" ? `${Math.round(Math.abs(diff) * 100)} điểm %` : kind === "money" ? formatVnd(Math.abs(diff)) : `${number(Math.abs(diff))} món`;
  return `${diff > 0 ? "Tăng" : "Giảm"} ${amount} so với tuần trước (${better ? "tốt hơn" : "kém hơn"}).`;
}

/** Lượng bỏ đi của một nhóm, cộng theo g/ml/cái (không đổi qua lại giữa khối lượng, thể tích và số cái). */
export function categoryAmount(entry: Pick<WasteCategory, "grams" | "milliliters" | "pieces">) {
  const parts: string[] = [];
  if (entry.grams) parts.push(entry.grams >= 1000 ? `${number(entry.grams / 1000, 2)} kg` : `${number(entry.grams)} g`);
  if (entry.milliliters) parts.push(entry.milliliters >= 1000 ? `${number(entry.milliliters / 1000, 2)} lít` : `${number(entry.milliliters)} ml`);
  if (entry.pieces) parts.push(`${number(entry.pieces, 1)} cái/gói`);
  return parts.join(", ") || "—";
}

/** Ô số liệu của một ngày: ngày chưa ghi bữa nào hiện "chưa ghi" (không phải 0), ngày chưa tới hiện "—". */
export function nutritionCell(day: Pick<NutritionDay, "status">, value: number | null, unit: "kcal" | "g") {
  if (day.status === "future") return "—";
  if (day.status === "missing" || value === null) return "chưa ghi";
  return `${number(value)} ${unit}`;
}

/** Phần trăm so với mục tiêu (làm tròn), null khi chưa có mục tiêu. */
export const percentOfTarget = (value: number, target: number | null | undefined) => (target ? Math.round((value / target) * 100) : null);
