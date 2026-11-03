import { describe, expect, it } from "vitest";
import type { ConsumptionLine, MealCompletionResult } from "../../types";
import {
  consumptionLineDetail, consumptionStatusLabel, consumptionSummary, formatAmount, initialSelections, isLineSelectable, parseQuantity,
  restorationSummary, selectionErrors, toConsumption,
} from "./consumption.logic";

const line = (patch: Partial<ConsumptionLine>): ConsumptionLine => ({
  ingredientId: "i1", name: "Gạo", optional: false, required: { quantity: 50, unit: "G" }, status: "ENOUGH",
  deductions: [{ pantryItemId: "p1", name: "Gạo", quantity: 50, unit: "G", expiryDate: "2026-11-10T00:00:00.000Z", quantityAfter: 950 }],
  shortfall: 0, defaultQuantity: 50, otherUnits: [], ...patch,
});
const lines: ConsumptionLine[] = [
  line({}),
  line({ ingredientId: "i2", name: "Ớt", optional: true, status: "OPTIONAL", defaultQuantity: 0, required: { quantity: 5, unit: "G" } }),
  line({ ingredientId: "i3", name: "Cá basa", status: "EXPIRED_ONLY", deductions: [], defaultQuantity: 0, shortfall: 200, required: { quantity: 200, unit: "G" } }),
  line({ ingredientId: "i4", name: "Hành lá", status: "NOT_IN_PANTRY", deductions: [], defaultQuantity: 0, shortfall: 10 }),
  line({ ingredientId: "i5", name: "Cà rốt", status: "UNIT_MISMATCH", deductions: [], defaultQuantity: 0, otherUnits: ["ITEM"], required: { quantity: 150, unit: "G" } }),
  line({ ingredientId: "i6", name: "Gừng", status: "SHORT", shortfall: 0.005, required: { quantity: 0.015, unit: "KG" }, defaultQuantity: 0.01,
    deductions: [{ pantryItemId: "p6", name: "Gừng", quantity: 10, unit: "G", expiryDate: null, quantityAfter: 0 }] }),
];

describe("Consumption line labels (text, colour is secondary)", () => {
  it("names every status in Vietnamese with a tone", () => {
    expect(lines.map((item) => consumptionStatusLabel(item))).toEqual([
      { text: "Đủ", tone: "ok" }, { text: "Tùy chọn", tone: "muted" }, { text: "Chỉ còn món đã hết hạn", tone: "warn" },
      { text: "Không có trong kho", tone: "muted" }, { text: "Khác đơn vị", tone: "muted" }, { text: "Thiếu 5 g", tone: "warn" },
    ]);
  });

  it("explains where the amount comes from, or why nothing can be deducted", () => {
    expect(consumptionLineDetail(lines[0])).toBe("Trừ 50 g Gạo, hạn 10/11.");
    expect(consumptionLineDetail(line({ deductions: [{ ...lines[0].deductions[0], quantity: 0.05, unit: "KG" }] }))).toBe("Trừ 50 g Gạo, hạn 10/11.");
    expect(consumptionLineDetail(lines[1])).toBe("Nếu chọn: trừ 50 g Gạo, hạn 10/11.");
    expect(consumptionLineDetail(lines[3])).toBe("Kho không có thực phẩm cùng tên còn số lượng.");
    expect(consumptionLineDetail(lines[4])).toBe("Kho tính theo cái, không quy đổi được sang g.");
    expect(consumptionLineDetail(lines[2])).toContain("đã hết hạn nên mặc định không trừ");
    expect(consumptionLineDetail(lines[5])).toBe("Trừ 10 g Gừng.");
  });

  it("formats pantry amounts with up to 3 decimals", () => {
    expect(formatAmount(0.015, "KG")).toBe("15 g");
    expect(formatAmount(0.25, "L")).toBe("250 ml");
    expect(formatAmount(1.5, "L")).toBe("1,5 lít");
    expect(formatAmount(2.125, "KG")).toBe("2,125 kg");
  });
});

describe("Selections and payload", () => {
  it("selects by default only lines with a default amount; optional and expired-only start unchecked", () => {
    const selections = initialSelections(lines);
    expect(Object.fromEntries(Object.entries(selections).map(([id, value]) => [id, value.included]))).toEqual({
      i1: true, i2: false, i3: false, i4: false, i5: false, i6: true,
    });
    expect(selections.i2.quantity).toBe("5");
    expect(selections.i6.quantity).toBe("0,01");
  });

  it("only lines with something to deduct are selectable", () => {
    expect(lines.map(isLineSelectable)).toEqual([true, true, true, false, false, true]);
  });

  it("parses Vietnamese decimals and rejects non-positive or huge values", () => {
    expect(parseQuantity("0,5")).toBe(0.5);
    expect(parseQuantity(" 12 ")).toBe(12);
    for (const bad of ["", "0", "-1", "abc", "100001"]) expect(parseQuantity(bad)).toBeNull();
  });

  it("sends the edited amounts of selected lines in the recipe unit; nothing selected → mark only", () => {
    const selections = { ...initialSelections(lines), i1: { included: true, quantity: "40" }, i3: { included: true, quantity: "200" }, i6: { included: false, quantity: "0,01" } };
    expect(toConsumption(lines, selections)).toEqual({ mode: "deduct", lines: [
      { ingredientId: "i1", quantity: 40, unit: "G" }, { ingredientId: "i3", quantity: 200, unit: "G" },
    ] });
    const none = Object.fromEntries(lines.map((item) => [item.ingredientId, { included: false, quantity: "1" }]));
    expect(toConsumption(lines, none)).toEqual({ mode: "none" });
  });

  it("flags only selected lines with an invalid amount", () => {
    const selections = { ...initialSelections(lines), i1: { included: true, quantity: "0" }, i2: { included: false, quantity: "abc" } };
    expect(selectionErrors(lines, selections)).toEqual({ i1: "Nhập số lớn hơn 0." });
  });
});

describe("Notices after marking / undoing", () => {
  const base = { id: "m1", completed: true, alreadyCompleted: false, consumption: null, restoration: null };

  it("summarises what was deducted, summed per pantry item", () => {
    const result: MealCompletionResult = { ...base, consumption: { skippedIngredients: [], lines: [
      { ...lines[0], skipped: [] },
      { ...lines[5], deductions: [{ ...lines[5].deductions[0], quantity: 15 }], skipped: [] },
    ] } };
    expect(consumptionSummary("Cháo gà", result)).toBe("Đã đánh dấu đã ăn: Cháo gà. Đã trừ 50 g Gạo, 15 g Gừng.");
    expect(consumptionSummary("Cháo gà", { ...base, consumption: null })).toBe("Đã đánh dấu đã ăn: Cháo gà. Không trừ kho.");
    expect(consumptionSummary("Cháo gà", { ...base, alreadyCompleted: true })).toContain("đã được đánh dấu đã ăn trước đó");
  });

  it("mentions lines skipped because the pantry changed meanwhile", () => {
    const result: MealCompletionResult = { ...base, consumption: { skippedIngredients: [], lines: [
      { ...lines[0], deductions: [], skipped: [{ pantryItemId: "p1", reason: "CHANGED" }] },
    ] } };
    expect(consumptionSummary("Cháo gà", result)).toBe("Đã đánh dấu đã ăn: Cháo gà. Không trừ kho. Chưa trừ Gạo vì kho vừa thay đổi.");
  });

  it("reports what was restored and what could not be restored", () => {
    const result: MealCompletionResult = { ...base, completed: false, restoration: {
      restored: [{ pantryItemId: "p1", name: "Gạo", quantity: 50, unit: "G", quantityAfter: 1000 }],
      skipped: [{ itemName: "Hành tím", quantity: 4, unit: "G", reason: "DELETED" }, { itemName: "Ớt", quantity: 5, unit: "G", reason: "UNIT_MISMATCH" }],
    } };
    expect(restorationSummary("Cháo gà", result)).toBe(
      "Đã bỏ đánh dấu đã ăn: Cháo gà. Đã hoàn lại 50 g Gạo vào kho. Không hoàn lại được 4 g Hành tím (đã xóa khỏi kho), 5 g Ớt (đã đổi sang đơn vị không quy đổi được).",
    );
    expect(restorationSummary("Cháo gà", { ...base, completed: false, restoration: { restored: [], skipped: [] } })).toBe("Đã bỏ đánh dấu đã ăn: Cháo gà.");
  });
});
