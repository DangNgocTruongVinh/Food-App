import { describe, expect, it } from "vitest";
import { planConsumption, requiredQuantity, type ConsumptionIngredient, type ConsumptionPantryItem } from "./pantry-consumption.js";

const now = new Date("2026-11-03T08:00:00.000Z");
const day = (offset: number) => new Date(Date.UTC(2026, 10, 3 + offset));
const ingredient = (id: string, name: string, quantity: number, unit: ConsumptionIngredient["unit"], optional = false): ConsumptionIngredient => ({
  id, name, quantity, unit, optional,
});
const pantry = (id: string, name: string, quantity: number, unit: ConsumptionPantryItem["unit"], expiryDate: Date | null): ConsumptionPantryItem => ({
  id, name, quantity, unit, expiryDate, createdAt: new Date("2026-11-01T00:00:00.000Z"),
});
const plan = (ingredients: ConsumptionIngredient[], items: ConsumptionPantryItem[], servings = 1, recipeServings = 1, amounts?: Map<string, { quantity: number; unit: ConsumptionIngredient["unit"] }>) =>
  planConsumption(ingredients, servings, recipeServings, items, now, amounts);

describe("Required quantity per meal", () => {
  it("scales the recipe amount (for recipe.servings) to the meal's servings", () => {
    expect(requiredQuantity(300, 1, 1)).toBe(300);
    expect(requiredQuantity(300, 1, 2)).toBe(150);
    expect(requiredQuantity(300, 3, 2)).toBe(450);
    expect(requiredQuantity(1, 1, 3)).toBe(0.333);
    expect(requiredQuantity(200, 2, 0)).toBe(400);
  });
});

describe("Consumption preview lines", () => {
  it("ENOUGH: takes from the soonest-expiring item first, undated items last", () => {
    const [line] = plan([ingredient("i1", "Đậu hũ", 300, "G")], [
      pantry("late", "Đậu hũ", 500, "G", day(5)),
      pantry("none", "đậu hũ ", 500, "G", null),
      pantry("soon", "Đậu hũ", 200, "G", day(1)),
    ]);
    expect(line.status).toBe("ENOUGH");
    expect(line.deductions.map((d) => [d.pantryItemId, d.quantity, d.quantityAfter])).toEqual([["soon", 200, 0], ["late", 100, 400]]);
    expect(line.defaultQuantity).toBe(300);
    expect(line.shortfall).toBe(0);
  });

  it("SHORT: takes everything available, never below 0, and reports the shortfall", () => {
    const [line] = plan([ingredient("i1", "Trứng gà", 4, "ITEM")], [pantry("p", "Trứng gà", 3, "ITEM", day(4))]);
    expect(line).toMatchObject({ status: "SHORT", shortfall: 1, defaultQuantity: 3 });
    expect(line.deductions).toEqual([expect.objectContaining({ pantryItemId: "p", quantity: 3, quantityAfter: 0 })]);
  });

  it("converts g ↔ kg and ml ↔ l, deducting in the pantry item's own unit", () => {
    const [rice, milk] = plan([ingredient("i1", "Gạo", 250, "G"), ingredient("i2", "Sữa tươi", 0.2, "L")], [
      pantry("rice", "Gạo", 1.5, "KG", null),
      pantry("milk", "Sữa tươi", 180, "ML", day(2)),
    ]);
    expect(rice.deductions).toEqual([expect.objectContaining({ quantity: 0.25, unit: "KG", quantityAfter: 1.25 })]);
    expect(milk).toMatchObject({ status: "SHORT", shortfall: 0.02 });
    expect(milk.deductions).toEqual([expect.objectContaining({ quantity: 180, unit: "ML", quantityAfter: 0 })]);
  });

  it("NOT_IN_PANTRY when no item with that name has stock left (a depleted item does not count)", () => {
    const [line] = plan([ingredient("i1", "Hành lá", 20, "G")], [pantry("p", "Hành lá", 0, "G", day(2))]);
    expect(line).toMatchObject({ status: "NOT_IN_PANTRY", deductions: [], defaultQuantity: 0 });
  });

  it("UNIT_MISMATCH when the item exists only in a unit that cannot be converted", () => {
    const [line] = plan([ingredient("i1", "Cà rốt", 150, "G")], [pantry("p", "Cà rốt", 2, "ITEM", day(3))]);
    expect(line).toMatchObject({ status: "UNIT_MISMATCH", deductions: [], defaultQuantity: 0, otherUnits: ["ITEM"] });
  });

  it("EXPIRED_ONLY: an expired item is not deducted by default", () => {
    const [line] = plan([ingredient("i1", "Cá basa", 200, "G")], [pantry("p", "Cá basa", 500, "G", day(-1))]);
    expect(line).toMatchObject({ status: "EXPIRED_ONLY", deductions: [], defaultQuantity: 0 });
  });

  it("OPTIONAL: previewed with a suggested allocation but defaults to 0, without reserving stock for later lines", () => {
    const [chili, chili2] = plan([ingredient("i1", "Ớt", 10, "G", true), ingredient("i2", "Ớt", 10, "G")], [pantry("p", "Ớt", 10, "G", null)]);
    expect(chili).toMatchObject({ status: "OPTIONAL", defaultQuantity: 0 });
    expect(chili.deductions).toHaveLength(1);
    expect(chili2).toMatchObject({ status: "ENOUGH", defaultQuantity: 10 });
  });

  it("uses the user's edited amount (in any convertible unit) when confirming; an optional line is then deducted", () => {
    const amounts = new Map([["i1", { quantity: 0.1, unit: "KG" as const }], ["i2", { quantity: 5, unit: "G" as const }]]);
    const [tofu, chili] = plan([ingredient("i1", "Đậu hũ", 300, "G"), ingredient("i2", "Ớt", 10, "G", true)], [
      pantry("tofu", "Đậu hũ", 400, "G", day(2)), pantry("chili", "Ớt", 10, "G", null),
    ], 1, 1, amounts);
    expect(tofu.deductions).toEqual([expect.objectContaining({ quantity: 100, unit: "G", quantityAfter: 300 })]);
    expect(chili).toMatchObject({ status: "ENOUGH", defaultQuantity: 5 });
  });

  it("scales to the meal's servings for a multi-serving recipe", () => {
    const [line] = plan([ingredient("i1", "Thịt bò", 400, "G")], [pantry("p", "Thịt bò", 1000, "G", day(2))], 1, 4);
    expect(line.required).toEqual({ quantity: 100, unit: "G" });
    expect(line.deductions[0]).toMatchObject({ quantity: 100, quantityAfter: 900 });
  });

  it("does not double-count one pantry item across two ingredients with the same name", () => {
    const [a, b] = plan([ingredient("i1", "Hành tím", 30, "G"), ingredient("i2", "Hành tím", 30, "G")], [pantry("p", "Hành tím", 40, "G", null)]);
    expect(a).toMatchObject({ status: "ENOUGH", shortfall: 0 });
    expect(b).toMatchObject({ status: "SHORT", shortfall: 20 });
    expect(b.deductions[0]).toMatchObject({ quantity: 10, quantityAfter: 0 });
  });
});
