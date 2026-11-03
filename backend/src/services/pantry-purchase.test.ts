import { describe, expect, it } from "vitest";
import { choosePurchaseTarget, suggestedPantryDefaults } from "./pantry-purchase.js";

// 23:30 ngày 03/11 giờ UTC = 06:30 ngày 04/11 giờ Việt Nam: hạn gợi ý tính từ ngày Việt Nam.
const now = new Date("2026-11-03T23:30:00.000Z");
const vnDay = (offset: number) => new Date(Date.UTC(2026, 10, 4 + offset));
const item = (id: string, name: string, quantity: number, unit: "G" | "KG" | "ITEM" | "ML", expiryDate: Date | null) => ({ id, name, quantity, unit, expiryDate });

describe("Suggested pantry defaults for a purchased item (decision 5)", () => {
  it.each([
    ["Cải ngọt", null, "Rau củ", "REFRIGERATOR", 5],
    ["Ức gà", "Thịt & cá", "Thịt & cá", "REFRIGERATOR", 2],
    ["Trứng", null, "Trứng & sữa", "REFRIGERATOR", 7],
    ["Đậu hũ", "Đậu & hạt", "Đậu & hạt", "REFRIGERATOR", 3],
    ["Đậu phộng", "Đậu & hạt", "Đậu & hạt", "DRY_STORAGE", 90],
    ["Đậu xanh", null, "Đậu & hạt", "DRY_STORAGE", 90],
    ["Gạo", null, "Ngũ cốc", "DRY_STORAGE", 180],
    ["Bún khô", null, "Ngũ cốc", "DRY_STORAGE", 180],
    ["Bánh mì", "Ngũ cốc", "Ngũ cốc", "DRY_STORAGE", 2],
    ["Bánh mì sandwich", null, "Ngũ cốc", "DRY_STORAGE", 2],
    ["Bánh cuốn", null, "Ngũ cốc", "REFRIGERATOR", 2],
    ["Mì tươi", null, "Ngũ cốc", "REFRIGERATOR", 2],
    ["Bún tươi", null, "Ngũ cốc", "REFRIGERATOR", 2],
    ["Bánh phở", null, "Ngũ cốc", "REFRIGERATOR", 2],
    ["Chuối", null, "Trái cây", "REFRIGERATOR", 5],
    ["Nước mắm", null, "Gia vị", "DRY_STORAGE", 180],
  ])("%s → %s, %s, %i ngày, hạn ước tính", (name, category, expected, storage, days) => {
    expect(suggestedPantryDefaults(name, category, now)).toEqual({
      category: expected, storageLocation: storage, expiryDate: vnDay(days), expiryEstimated: true,
    });
  });

  it("sets no expiry for the group Khác (not estimated), and keeps an unknown stored category", () => {
    expect(suggestedPantryDefaults("Đá viên", null, now)).toEqual({ category: "Khác", storageLocation: "REFRIGERATOR", expiryDate: null, expiryEstimated: false });
    expect(suggestedPantryDefaults("Đậu hũ", "Đồ chay", now)).toMatchObject({ category: "Đồ chay", storageLocation: "REFRIGERATOR", expiryDate: null });
  });
});

describe("Choosing where a purchase goes in the pantry", () => {
  it("merges into the non-expired same-name item with the latest expiry (no expiry counts as latest), matching names loosely", () => {
    const soon = item("a", "đậu  hũ", 100, "G", vnDay(1));
    const late = item("b", "Đậu hũ", 0.2, "KG", vnDay(4));
    expect(choosePurchaseTarget([soon, late], "Đậu hũ", "G", now)).toEqual({ kind: "merge", item: late });
    const open = item("c", "ĐẬU HŨ", 50, "G", null);
    expect(choosePurchaseTarget([soon, late, open], " Đậu  hũ ", "G", now)).toEqual({ kind: "merge", item: open });
  });

  it("skips expired items and items in a unit that cannot be converted", () => {
    const expired = item("a", "Ức gà", 300, "G", vnDay(-3));
    const pieces = item("b", "Ức gà", 2, "ITEM", null);
    expect(choosePurchaseTarget([expired, pieces], "Ức gà", "G", now)).toEqual({ kind: "create" });
  });

  it("reuses a depleted same-name item only when no item with stock is usable", () => {
    const depleted = item("a", "Trứng", 0, "ITEM", vnDay(-10));
    expect(choosePurchaseTarget([depleted], "Trứng", "ITEM", now)).toEqual({ kind: "reuse", item: depleted });
    const fresh = item("b", "Trứng", 2, "ITEM", vnDay(3));
    expect(choosePurchaseTarget([depleted, fresh], "Trứng", "ITEM", now)).toEqual({ kind: "merge", item: fresh });
    expect(choosePurchaseTarget([item("c", "Trứng", 0, "G", null)], "Trứng", "ITEM", now)).toEqual({ kind: "create" });
  });

  it("creates a new item when nothing matches by name", () => {
    expect(choosePurchaseTarget([item("a", "Đậu hũ non", 100, "G", null)], "Đậu hũ", "G", now)).toEqual({ kind: "create" });
  });
});
