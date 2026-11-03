import type { ConsumptionLine, ConsumptionSkipReason, FoodUnit, MealCompletionResult } from "../../types";
import { formatDayMonth } from "../../utils/date";
import { foodUnitLabel } from "../../utils/units";
import type { MealConsumption } from "./meal-plans.api";

// Hộp "Đã ăn" → trừ kho (GĐ3b): logic thuần cho ConsumeMealDialog và dòng nhắc sau khi đánh dấu/hoàn tác.

/** Lượng dễ đọc, tối đa 3 chữ số thập phân; dưới 1 kg / 1 lít thì đổi sang g / ml ("0,015 kg" → "15 g"). */
export function formatAmount(quantity: number, unit: FoodUnit) {
  const small = (unit === "KG" || unit === "L") && quantity > 0 && quantity < 1;
  const value = small ? Math.round(quantity * 1000 * 1000) / 1000 : quantity;
  const shown: FoodUnit = small ? (unit === "KG" ? "G" : "ML") : unit;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value)} ${foodUnitLabel[shown]}`;
}

export type LineTone = "ok" | "warn" | "muted";

/** Trạng thái bằng chữ (màu chỉ là kênh phụ). */
export function consumptionStatusLabel(line: ConsumptionLine): { text: string; tone: LineTone } {
  switch (line.status) {
    case "ENOUGH": return { text: "Đủ", tone: "ok" };
    case "SHORT": return { text: `Thiếu ${formatAmount(line.shortfall, line.required.unit)}`, tone: "warn" };
    case "NOT_IN_PANTRY": return { text: "Không có trong kho", tone: "muted" };
    case "UNIT_MISMATCH": return { text: "Khác đơn vị", tone: "muted" };
    case "EXPIRED_ONLY": return { text: "Chỉ còn món đã hết hạn", tone: "warn" };
    case "OPTIONAL": return { text: "Tùy chọn", tone: "muted" };
  }
}

/** Câu giải thích dưới tên nguyên liệu: trừ từ thực phẩm nào, hoặc vì sao không trừ được. */
export function consumptionLineDetail(line: ConsumptionLine) {
  if (line.status === "NOT_IN_PANTRY") return "Kho không có thực phẩm cùng tên còn số lượng.";
  if (line.status === "UNIT_MISMATCH") {
    return `Kho tính theo ${line.otherUnits.map((unit) => foodUnitLabel[unit]).join(", ")}, không quy đổi được sang ${foodUnitLabel[line.required.unit]}.`;
  }
  if (line.status === "EXPIRED_ONLY") return "Thực phẩm cùng tên trong kho đã hết hạn nên mặc định không trừ. Chọn nếu bạn vẫn đã dùng nó.";
  if (!line.deductions.length) return "";
  const from = line.deductions.map((deduction) => {
    const expiry = deduction.expiryDate ? `, hạn ${formatDayMonth(deduction.expiryDate)}` : "";
    return `${formatAmount(deduction.quantity, deduction.unit)} ${deduction.name}${expiry}`;
  });
  return `${line.status === "OPTIONAL" ? "Nếu chọn: trừ" : "Trừ"} ${from.join("; ")}.`;
}

/** Dòng chọn được (có thực phẩm để trừ): không có trong kho / khác đơn vị thì không có gì để trừ. */
export function isLineSelectable(line: ConsumptionLine) {
  return line.status !== "NOT_IN_PANTRY" && line.status !== "UNIT_MISMATCH";
}

export type LineSelection = { included: boolean; quantity: string };

const toText = (value: number) => String(value).replace(".", ",");

/** Mặc định: trừ đúng lượng gợi ý; dòng tùy chọn và chỉ còn món hết hạn không chọn sẵn (vẫn điền lượng cần nếu người dùng chọn). */
export function initialSelections(lines: ConsumptionLine[]): Record<string, LineSelection> {
  return Object.fromEntries(lines.map((line) => [line.ingredientId, {
    included: line.defaultQuantity > 0,
    quantity: toText(line.defaultQuantity > 0 ? line.defaultQuantity : line.required.quantity),
  }]));
}

/** "0,5" hoặc "0.5" → 0,5; không phải số dương ≤ 100.000 → null. */
export function parseQuantity(text: string) {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(value) && value > 0 && value <= 100_000 ? value : null;
}

/** Lỗi theo dòng (chỉ dòng đang chọn). */
export function selectionErrors(lines: ConsumptionLine[], selections: Record<string, LineSelection>) {
  return Object.fromEntries(lines
    .filter((line) => selections[line.ingredientId]?.included && parseQuantity(selections[line.ingredientId].quantity) === null)
    .map((line) => [line.ingredientId, "Nhập số lớn hơn 0."]));
}

/** Dữ liệu gửi PATCH: chỉ các dòng đang chọn, lượng theo đơn vị của công thức. Không chọn dòng nào → chỉ đánh dấu. */
export function toConsumption(lines: ConsumptionLine[], selections: Record<string, LineSelection>): MealConsumption {
  const chosen = lines.flatMap((line) => {
    const selection = selections[line.ingredientId];
    const quantity = selection?.included ? parseQuantity(selection.quantity) : null;
    return quantity && isLineSelectable(line) ? [{ ingredientId: line.ingredientId, quantity, unit: line.required.unit }] : [];
  });
  return chosen.length ? { mode: "deduct", lines: chosen } : { mode: "none" };
}

/** Gộp theo thực phẩm (một thực phẩm có thể bị trừ ở nhiều dòng), giữ thứ tự xuất hiện. */
function sumByItem(entries: Array<{ name: string; quantity: number; unit: FoodUnit }>) {
  const totals = new Map<string, { name: string; quantity: number; unit: FoodUnit }>();
  for (const entry of entries) {
    const key = `${entry.name}|${entry.unit}`;
    const current = totals.get(key);
    totals.set(key, { ...entry, quantity: Math.round(((current?.quantity ?? 0) + entry.quantity) * 1000) / 1000 });
  }
  return [...totals.values()].map((entry) => `${formatAmount(entry.quantity, entry.unit)} ${entry.name}`);
}

/** Dòng nhắc sau khi đánh dấu đã ăn: "Đã trừ 50 g Gạo, 15 g Gừng." */
export function consumptionSummary(recipeName: string, result: MealCompletionResult) {
  if (result.alreadyCompleted) return `Bữa ${recipeName} đã được đánh dấu đã ăn trước đó, kho không đổi.`;
  const deducted = sumByItem(result.consumption?.lines.flatMap((line) => line.deductions) ?? []);
  const skipped = result.consumption?.lines.filter((line) => line.skipped.length).map((line) => line.name) ?? [];
  const parts = [`Đã đánh dấu đã ăn: ${recipeName}.`, deducted.length ? `Đã trừ ${deducted.join(", ")}.` : "Không trừ kho."];
  if (skipped.length) parts.push(`Chưa trừ ${skipped.join(", ")} vì kho vừa thay đổi.`);
  return parts.join(" ");
}

const SKIP_REASON: Record<ConsumptionSkipReason, string> = {
  DELETED: "đã xóa khỏi kho",
  UNIT_MISMATCH: "đã đổi sang đơn vị không quy đổi được",
  CHANGED: "kho vừa thay đổi",
};

/** Dòng nhắc sau khi bỏ đánh dấu: những gì đã hoàn lại và những gì không hoàn được. */
export function restorationSummary(recipeName: string, result: MealCompletionResult) {
  const restored = sumByItem(result.restoration?.restored ?? []);
  const skipped = (result.restoration?.skipped ?? []).map((item) => `${formatAmount(item.quantity, item.unit)} ${item.itemName} (${SKIP_REASON[item.reason]})`);
  const parts = [`Đã bỏ đánh dấu đã ăn: ${recipeName}.`];
  if (restored.length) parts.push(`Đã hoàn lại ${restored.join(", ")} vào kho.`);
  if (skipped.length) parts.push(`Không hoàn lại được ${skipped.join(", ")}.`);
  return parts.join(" ");
}
