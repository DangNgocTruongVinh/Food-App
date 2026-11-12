import { describe, expect, it } from "vitest";
import { recentWeeks, summarizeWaste } from "../src/modules/reports/reports.logic.js";
import { DEMO_REPORT_MEALS, demoReportTransactions } from "./demo-report.js";

describe("Dữ liệu mẫu trang Báo cáo (demo:reset)", () => {
  const now = new Date("2026-11-13T03:00:00.000Z"); // Thứ Sáu, 10:00 giờ Việt Nam

  it("8 tuần, có bỏ đi và dùng trước hạn, xu hướng cải thiện dần; không dòng nào ở tương lai", () => {
    const rows = demoReportTransactions("demo-id", now);
    expect(rows.every((row) => new Date(row.createdAt!).getTime() < now.getTime())).toBe(true);
    const report = summarizeWaste(rows.map((row) => ({
      createdAt: new Date(row.createdAt!), source: row.source, delta: row.delta, quantityAfter: row.quantityAfter, unit: row.unit,
      removalReason: row.removalReason ?? null, category: row.category ?? null, expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
      unitPrice: row.unitPrice ?? null, reversedAt: null, reversalOfId: null,
    })), recentWeeks(now, 8));
    const discarded = report.weeks.map((week) => week.discarded);
    const onTime = report.weeks.map((week) => week.onTimeRate ?? 0);
    expect(discarded).toEqual([4, 4, 3, 3, 2, 2, 1, 1]);
    expect(onTime.at(-1)!).toBeGreaterThan(onTime[0]);
    expect(report.totals.pricedDiscards).toBeGreaterThan(0);
    expect(report.totals.pricedDiscards).toBeLessThan(report.totals.discarded); // "ước tính trên N món có giá"
  });

  it("bữa đã ăn mẫu bỏ trống một ngày để báo cáo hiện \"chưa ghi\"", () => {
    const days = new Set(DEMO_REPORT_MEALS.map((meal) => meal.day));
    expect(days.has(-3)).toBe(false);
    expect([...days].every((day) => day < 0)).toBe(true);
  });
});
