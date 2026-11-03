import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { queryKeys } from "../../api/query-keys";
import type { PantryTransaction } from "../../types";
import { listPantryTransactions } from "./pantry.api";
import {
  HISTORY_SOURCE_LABELS, historyAfter, historyDelta, historyLink, historyNote, historyPageCount, historyRange, historyReversalTag, historyTime,
} from "./pantry-history.logic";

const entry = (patch: Partial<PantryTransaction>): PantryTransaction => ({
  id: "t1", pantryItemId: "p1", itemName: "Đậu hũ", unit: "G", delta: 300, quantityAfter: 300, source: "PURCHASE", note: null,
  reversalOfId: null, reversedAt: null, createdAt: "2026-11-03T07:05:00.000Z", mealPlanItem: null, shoppingItem: null, ...patch,
});
const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

describe("Pantry history rows", () => {
  it("labels every source in Vietnamese", () => {
    expect(HISTORY_SOURCE_LABELS).toEqual({
      MANUAL_ADD: "Nhập tay", MANUAL_EDIT: "Sửa tay", MANUAL_DELETE: "Xóa", CONSUMPTION: "Tiêu thụ", PURCHASE: "Mua sắm", RECEIPT_SCAN: "Quét hóa đơn",
    });
  });

  it("shows signed changes and what is left", () => {
    expect(historyDelta(entry({ delta: 500 }))).toBe("+500 g");
    expect(historyDelta(entry({ delta: -200 }))).toBe("−200 g");
    expect(historyDelta(entry({ delta: -0.25, unit: "KG" }))).toBe("−0,25 kg");
    expect(historyDelta(entry({ delta: 0 }))).toBe("0 g");
    expect(historyAfter(entry({ quantityAfter: 200 }))).toBe("Còn 200 g");
    expect(historyAfter(entry({ source: "MANUAL_DELETE", quantityAfter: 0 }))).toBe("Đã xóa khỏi kho");
  });

  it("marks reversal rows and reversed originals", () => {
    expect(historyReversalTag(entry({ reversalOfId: "t0" }))).toBe("Hoàn lại");
    expect(historyReversalTag(entry({ reversedAt: "2026-11-03T08:00:00.000Z" }))).toBe("Đã hoàn lại");
    expect(historyReversalTag(entry({}))).toBeNull();
  });

  it("links to the meal (its plan) or the plan's shopping list", () => {
    const mealPlanItem = { id: "m1", mealType: "LUNCH" as const, recipe: { name: "Đậu hũ sốt cà" }, day: { date: "2026-11-03T00:00:00.000Z", mealPlanId: "plan-a" } };
    expect(historyLink(entry({ source: "CONSUMPTION", mealPlanItem }))).toEqual({ to: "/meal-plans/plan-a", label: "Bữa trưa 03/11: Đậu hũ sốt cà" });
    expect(historyLink(entry({ shoppingItem: { id: "s1", name: "Đậu hũ", mealPlanId: "plan-b" } }))).toEqual({
      to: "/meal-plans/plan-b", label: "Danh sách đi chợ của thực đơn",
    });
    expect(historyLink(entry({ source: "MANUAL_ADD" }))).toBeNull();
  });

  it("formats the time in Vietnam time and keeps useful notes", () => {
    expect(historyTime(entry({ createdAt: "2026-11-02T17:05:00.000Z" }))).toBe("00:05, 03/11/2026");
    expect(historyNote(entry({ note: "Đổi đơn vị: 2 cái → 300 g" }))).toBe("Đổi đơn vị: 2 cái → 300 g");
    expect(historyNote(entry({ note: "  " }))).toBeNull();
  });

  it("describes the page range", () => {
    expect(historyRange(2, 20, 57)).toBe("Hiển thị 21–40 trong 57 thay đổi");
    expect(historyRange(3, 20, 57)).toBe("Hiển thị 41–57 trong 57 thay đổi");
    expect(historyRange(1, 20, 0)).toBe("Không có thay đổi nào");
    expect(historyPageCount(20, 57)).toBe(3);
    expect(historyPageCount(20, 0)).toBe(1);
  });
});

describe("Pantry history API", () => {
  it("sends only the filters that are set, under the pantry query prefix", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: { items: [], total: 0, page: 1, pageSize: 20 }, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await listPantryTransactions({ page: 1, pageSize: 20 });
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/pantry/transactions", params: { page: 1, pageSize: 20 } });
    await listPantryTransactions({ source: "CONSUMPTION", pantryItemId: "p1", page: 2, pageSize: 10 });
    expect(adapter.mock.calls[1][0].params).toEqual({ page: 2, pageSize: 10, source: "CONSUMPTION", pantryItemId: "p1" });
    expect(queryKeys.pantryTransactions({ page: 1, pageSize: 20 }).slice(0, 1)).toEqual(queryKeys.pantry);
  });
});
