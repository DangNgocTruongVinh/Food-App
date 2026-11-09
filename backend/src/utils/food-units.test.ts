import { describe, expect, it } from "vitest";
import { canConvertUnit, convertQuantity, roundQuantity } from "./food-units.js";

describe("Food unit conversion", () => {
  it("converts g ↔ kg and ml ↔ l", () => {
    expect(convertQuantity(1500, "G", "KG")).toBe(1.5);
    expect(convertQuantity(0.25, "KG", "G")).toBe(250);
    expect(convertQuantity(750, "ML", "L")).toBe(0.75);
    expect(convertQuantity(2, "L", "ML")).toBe(2000);
    expect(convertQuantity(3, "ITEM", "ITEM")).toBe(3);
  });

  it("refuses to convert between mass, volume, items and packages", () => {
    for (const [from, to] of [["G", "ML"], ["KG", "L"], ["ITEM", "G"], ["PACKAGE", "ITEM"], ["L", "PACKAGE"]] as const) {
      expect(canConvertUnit(from, to)).toBe(false);
      expect(convertQuantity(1, from, to)).toBeNull();
    }
  });

  it("rounds away floating point noise", () => {
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
    expect(convertQuantity(333, "G", "KG")).toBe(0.333);
  });
});
