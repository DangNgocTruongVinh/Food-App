import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import { classifyWaste, recentWeeks, summarizeNutrition, summarizeWaste, vietnamWeekStart, type WasteRow } from "./reports.logic.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters", findTransactions: vi.fn(), findItems: vi.fn(), findProfile: vi.fn(),
}));
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  pantryTransaction: { findMany: mocks.findTransactions },
  mealPlanItem: { findMany: mocks.findItems },
  nutritionProfile: { findUnique: mocks.findProfile },
} }));
const reportRoutes = (await import("./reports.routes.js")).default;

// Thứ Sáu 13/11/2026, 10:00 giờ Việt Nam. Tuần này: Thứ Hai 09/11 → Chủ Nhật 15/11.
const now = new Date("2026-11-13T03:00:00.000Z");
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const row = (extra: Partial<WasteRow>): WasteRow => ({
  createdAt: new Date("2026-11-11T03:00:00.000Z"), source: "MANUAL_DELETE", delta: -500, quantityAfter: 0, unit: "G",
  removalReason: "DISCARDED", category: "Rau củ", expiryDate: day("2026-11-10"), unitPrice: null, reversedAt: null, reversalOfId: null,
  ...extra,
});

describe("Tuần theo giờ Việt Nam", () => {
  it("tuần bắt đầu Thứ Hai 00:00 giờ VN (= Chủ Nhật 17:00 UTC)", () => {
    expect(vietnamWeekStart(now).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    // 00:30 Thứ Hai giờ VN vẫn là Chủ Nhật theo UTC nhưng đã sang tuần mới.
    expect(vietnamWeekStart(new Date("2026-11-08T17:30:00.000Z")).toISOString()).toBe("2026-11-09T00:00:00.000Z");
    const [previous, current] = recentWeeks(now, 2);
    expect(current.from.toISOString()).toBe("2026-11-08T17:00:00.000Z");
    expect(previous.to.getTime()).toBe(current.from.getTime());
  });

  it("dòng lúc 23:30 Chủ Nhật giờ VN thuộc tuần trước, 00:10 Thứ Hai thuộc tuần này", () => {
    const weeks = recentWeeks(now, 2);
    const report = summarizeWaste([
      row({ createdAt: new Date("2026-11-08T16:30:00.000Z") }),
      row({ createdAt: new Date("2026-11-08T17:10:00.000Z") }),
      row({ createdAt: new Date("2026-11-08T17:20:00.000Z") }),
    ], weeks);
    expect(report.weeks.map((week) => [week.start, week.discarded])).toEqual([["2026-11-02", 1], ["2026-11-09", 2]]);
  });
});

describe("Lãng phí thực phẩm", () => {
  it.each([
    ["Bỏ đi", row({}), "discarded"],
    ["Nhập nhầm (không tính)", row({ removalReason: "MISTAKE" }), null],
    ["Đã dùng hết khi còn hàng", row({ removalReason: "USED_UP" }), "used"],
    ["Đã dùng hết với món đã về 0 (đã tính lúc dùng)", row({ removalReason: "USED_UP", delta: 0 }), null],
    ["trừ kho khi ăn", row({ source: "CONSUMPTION", removalReason: null, quantityAfter: 200 }), "used"],
    ["trừ kho đã hoàn tác", row({ source: "CONSUMPTION", removalReason: null, reversedAt: now }), null],
    ["dòng hoàn tác", row({ source: "CONSUMPTION", removalReason: null, delta: 300, reversalOfId: "tx-1" }), null],
    ["sửa về 0", row({ source: "MANUAL_EDIT", removalReason: null }), "used"],
    ["sửa giảm nhưng còn", row({ source: "MANUAL_EDIT", removalReason: null, quantityAfter: 100 }), null],
  ] as const)("%s → %s", (_label, input, expected) => {
    expect(classifyWaste(input)).toBe(expected);
  });

  it("tiền lãng phí chỉ tính món có giá; tỉ lệ dùng trước hạn; nhóm hay bỏ nhất; Nhập nhầm không vào số liệu", () => {
    const weeks = recentWeeks(now, 4);
    const report = summarizeWaste([
      row({ unitPrice: 40 }), // 500 g × 40 đ/g = 20.000 đ
      row({ category: "Sữa & trứng", unit: "L", delta: -1, unitPrice: null }),
      row({ category: "Rau củ", unit: "KG", delta: -0.2 }),
      row({ removalReason: "MISTAKE", unitPrice: 999 }),
      row({ source: "CONSUMPTION", removalReason: null, quantityAfter: 100, expiryDate: day("2026-11-12") }), // dùng trước hạn
      row({ source: "CONSUMPTION", removalReason: null, quantityAfter: 100, expiryDate: day("2026-11-10") }), // dùng sau hạn
    ], weeks);
    const current = report.weeks.at(-1)!;
    expect(current).toMatchObject({ discarded: 3, used: 2, usedBeforeExpiry: 1, wasteValue: 20_000, pricedDiscards: 1 });
    expect(current.onTimeRate).toBeCloseTo(1 / 5);
    expect(report.byCategory).toEqual([
      { category: "Rau củ", count: 2, grams: 700, milliliters: 0, pieces: 0 },
      { category: "Sữa & trứng", count: 1, grams: 0, milliliters: 1000, pieces: 0 },
    ]);
    expect(report.topCategory).toBe("Rau củ");
    expect(report.comparison).toEqual({
      discarded: { current: 3, previous: 0 }, onTimeRate: { current: 0.2, previous: null }, wasteValue: { current: 20_000, previous: 0 },
    });
    expect(report.weeks).toHaveLength(4);
  });

  it("chưa có dữ liệu → hasData false, tỉ lệ null (không phải 0 %)", () => {
    const report = summarizeWaste([row({ removalReason: "MISTAKE" })], recentWeeks(now, 4));
    expect(report.hasData).toBe(false);
    expect(report.totals.onTimeRate).toBeNull();
  });
});

describe("Dinh dưỡng tuần", () => {
  const meal = (date: string, calories: number) => ({ date: day(date), calories, servings: 2, recipe: { proteinG: 10, carbsG: 30, fatG: 5 } });
  const targets = { calories: 2000, proteinG: 100, carbsG: 250, fatG: 60 };

  it("ngày chưa ghi là 'missing' (không tính 0), ngày tới là 'future'; trung bình chỉ trên ngày đã ghi", () => {
    const report = summarizeNutrition([meal("2026-11-10", 600), meal("2026-11-10", 900), meal("2026-11-12", 1500)], day("2026-11-09"), now, targets);
    // Thứ Hai chưa ghi, Thứ Ba có 2 bữa, Thứ Tư chưa ghi, Thứ Năm 1 bữa, hôm nay (Thứ Sáu) chưa ghi, Thứ Bảy, Chủ Nhật chưa tới.
    expect(report.days.map((entry) => entry.status)).toEqual(["missing", "recorded", "missing", "recorded", "missing", "future", "future"]);
    expect(report.days[1]).toMatchObject({ calories: 1500, proteinG: 40, carbsG: 120, fatG: 20, meals: 2 });
    expect(report.days[0]).toMatchObject({ calories: null, proteinG: null });
    expect(report.recordedDays).toBe(2);
    expect(report.average).toEqual({ calories: 1500, proteinG: 30, carbsG: 90, fatG: 15 });
  });

  it("tuần chưa ghi bữa nào → average null", () => {
    expect(summarizeNutrition([], day("2026-11-02"), now, null)).toMatchObject({ recordedDays: 0, average: null, targets: null });
  });
});

describe("HTTP", () => {
  const app = testApp("/api/reports", reportRoutes);
  const token = () => `Bearer ${jwt.sign({ sub: "user-a", email: "a@nouri.vn" }, mocks.secret)}`;
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findTransactions.mockResolvedValue([]);
    mocks.findItems.mockResolvedValue([]);
    mocks.findProfile.mockResolvedValue({ dailyCalorieTarget: 1800, proteinTargetG: 90, carbTargetG: 220, fatTargetG: 55 });
  });

  it("chỉ đọc dữ liệu của người dùng trong JWT; 4 hoặc 8 tuần", async () => {
    const response = await request(app, "/api/reports/waste?weeks=8", { token: token() });
    expect(response.status).toBe(200);
    expect(response.body.weeks).toHaveLength(8);
    expect(mocks.findTransactions.mock.calls[0][0].where.userId).toBe("user-a");
    expect((await request(app, "/api/reports/waste?weeks=5", { token: token() })).status).toBe(422);
  });

  it("dinh dưỡng: lọc theo chủ thực đơn, mục tiêu từ hồ sơ; cần đăng nhập", async () => {
    const response = await request(app, "/api/reports/nutrition?week=previous", { token: token() });
    expect(response.body.targets).toEqual({ calories: 1800, proteinG: 90, carbsG: 220, fatG: 55 });
    expect(mocks.findItems.mock.calls[0][0].where).toMatchObject({ completed: true, day: { mealPlan: { userId: "user-a" } } });
    expect((await request(app, "/api/reports/nutrition")).status).toBe(401);
  });
});
