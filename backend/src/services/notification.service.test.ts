import { describe, expect, it } from "vitest";
import { buildPantryNotificationCandidates } from "./notification.service.js";

const now = new Date("2026-08-20T10:00:00.000Z");

function pantryItem(overrides: Partial<{
  id: string;
  userId: string;
  name: string;
  quantity: number;
  minimumStock: number;
  expiryDate: Date | null;
  updatedAt: Date;
}> = {}) {
  return {
    id: "item-1",
    userId: "user-1",
    name: "Ức gà",
    quantity: 500,
    minimumStock: 0,
    expiryDate: null,
    updatedAt: now,
    ...overrides,
  };
}

describe("buildPantryNotificationCandidates", () => {
  it("returns an empty list when there is nothing to notify", () => {
    expect(buildPantryNotificationCandidates([], now)).toEqual([]);
    expect(buildPantryNotificationCandidates([pantryItem({ expiryDate: new Date("2026-08-30T00:00:00.000Z") })], now)).toEqual([]);
  });

  it("creates one expiring notification inside the three-day window", () => {
    const result = buildPantryNotificationCandidates([
      pantryItem({ expiryDate: new Date("2026-08-22T00:00:00.000Z") }),
    ], now);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "PANTRY_EXPIRING",
      relatedId: "item-1",
      message: "Ức gà sẽ hết hạn sau 2 ngày.",
    });
  });

  it("creates expired and low-stock notifications with stable dedupe keys", () => {
    const item = pantryItem({
      quantity: 1,
      minimumStock: 2,
      expiryDate: new Date("2026-08-19T00:00:00.000Z"),
    });
    const first = buildPantryNotificationCandidates([item], now);
    const second = buildPantryNotificationCandidates([item], now);

    expect(first.map((notification) => notification.type)).toEqual(["PANTRY_EXPIRED", "PANTRY_LOW_STOCK"]);
    expect(first.map((notification) => notification.dedupeKey)).toEqual(second.map((notification) => notification.dedupeKey));
  });

  it("does not create notifications for depleted items", () => {
    const result = buildPantryNotificationCandidates([
      pantryItem({ quantity: 0, minimumStock: 2, expiryDate: new Date("2026-08-19T00:00:00.000Z") }),
    ], now);
    expect(result).toEqual([]);
  });
});
