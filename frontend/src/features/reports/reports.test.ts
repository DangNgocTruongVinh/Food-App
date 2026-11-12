import { describe, expect, it } from "vitest";
import { categoryAmount, compareText, formatPercent, formatVnd, nutritionCell, percentOfTarget, shortDate, weekdayName } from "./reports.logic";

describe("Báo cáo: định dạng", () => {
  it("tiền, phần trăm, ngày", () => {
    expect(formatVnd(20000.4)).toBe("20.000 đ");
    expect(formatPercent(0.666)).toBe("67 %");
    expect(formatPercent(null)).toBe("—");
    expect(shortDate("2026-11-09")).toBe("09/11");
    expect(weekdayName(6)).toBe("Chủ Nhật");
  });

  it("so với tuần trước nói đúng chiều tốt/xấu", () => {
    expect(compareText({ current: 1, previous: 3 }, "count")).toBe("Giảm 2 món so với tuần trước (tốt hơn).");
    expect(compareText({ current: 0.8, previous: 0.5 }, "rate")).toBe("Tăng 30 điểm % so với tuần trước (tốt hơn).");
    expect(compareText({ current: 30000, previous: 10000 }, "money")).toBe("Tăng 20.000 đ so với tuần trước (kém hơn).");
    expect(compareText({ current: 2, previous: 2 }, "count")).toBe("Bằng tuần trước.");
    expect(compareText({ current: 0.5, previous: null }, "rate")).toBe("Chưa đủ dữ liệu để so với tuần trước.");
  });

  it("lượng theo nhóm cộng theo g / ml / cái", () => {
    expect(categoryAmount({ grams: 1500, milliliters: 500, pieces: 2 })).toBe("1,5 kg, 500 ml, 2 cái/gói");
    expect(categoryAmount({ grams: 0, milliliters: 0, pieces: 0 })).toBe("—");
  });

  it("ngày chưa ghi bữa hiện 'chưa ghi', không phải 0; ngày chưa tới hiện '—'", () => {
    expect(nutritionCell({ status: "missing" }, null, "kcal")).toBe("chưa ghi");
    expect(nutritionCell({ status: "future" }, null, "kcal")).toBe("—");
    expect(nutritionCell({ status: "recorded" }, 1520, "kcal")).toBe("1.520 kcal");
    expect(nutritionCell({ status: "recorded" }, 0, "g")).toBe("0 g");
    expect(percentOfTarget(1500, 2000)).toBe(75);
    expect(percentOfTarget(1500, null)).toBeNull();
  });
});
