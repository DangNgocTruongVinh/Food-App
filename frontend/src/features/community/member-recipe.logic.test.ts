import { describe, expect, it } from "vitest";
import { applyRecipeEstimate, recipeFormFromMemberRecipe, guessFoodUnit, guessQuantity } from "../admin/admin-recipes.logic";
import {
  draftFromMemberRecipe, emptyMemberRecipeDraft, MEMBER_RECIPE_LIMITS, memberIngredientLabel, toMemberRecipe, type MemberRecipeDraft,
} from "./member-recipe.logic";

const draft = (change: Partial<MemberRecipeDraft> = {}): MemberRecipeDraft => ({
  name: " Canh chua tôm ",
  servings: "2",
  minutes: "30",
  ingredients: [
    { key: "a", name: "Tôm", quantity: "300", unit: "g" },
    { key: "b", name: "", quantity: "", unit: "" },
    { key: "c", name: "Muối", quantity: "", unit: "" },
  ],
  steps: [{ key: "s1", text: " Nấu nước dùng " }, { key: "s2", text: "" }],
  ...change,
});

describe("member recipe form → API payload", () => {
  it("trims text, drops empty rows and keeps free-form quantity/unit", () => {
    expect(toMemberRecipe(draft())).toEqual({
      recipe: {
        name: "Canh chua tôm", servings: 2, minutes: 30,
        ingredients: [{ name: "Tôm", quantity: "300", unit: "g" }, { name: "Muối", quantity: "", unit: "" }],
        steps: ["Nấu nước dùng"],
      },
    });
  });

  it.each([
    ["a one-letter name", { name: "A" }, "Tên món"],
    ["servings out of range", { servings: "21" }, "Khẩu phần"],
    ["minutes that are not whole", { minutes: "1.5" }, "Thời gian"],
    ["a quantity without a name", { ingredients: [{ key: "x", name: "", quantity: "2", unit: "quả" }] }, "cần có tên"],
    ["no ingredient", { ingredients: [{ key: "x", name: "", quantity: "", unit: "" }] }, "ít nhất một nguyên liệu"],
    ["no step", { steps: [{ key: "x", text: " " }] }, "ít nhất một bước"],
    ["too many steps", { steps: Array.from({ length: MEMBER_RECIPE_LIMITS.steps + 1 }, (_, i) => ({ key: `${i}`, text: "Khuấy" })) }, "Tối đa"],
  ])("explains %s", (_name, change, message) => {
    const result = toMemberRecipe(draft(change));
    expect("error" in result && result.error).toContain(message);
  });

  it("round-trips a saved recipe back into the edit form", () => {
    const saved = { name: "Bánh flan", servings: 4, minutes: 60, ingredients: [{ name: "Trứng", quantity: "4", unit: "quả" }], steps: ["Hấp"] };
    expect(toMemberRecipe(draftFromMemberRecipe(saved))).toEqual({ recipe: saved });
    expect(emptyMemberRecipeDraft().ingredients).toHaveLength(2);
  });

  it("shows an ingredient line without empty parts", () => {
    expect(memberIngredientLabel({ name: "Tôm", quantity: "300", unit: "g" })).toBe("300 g Tôm");
    expect(memberIngredientLabel({ name: "Muối", quantity: "", unit: "" })).toBe("Muối");
  });
});

describe("Admin: prefill a library recipe from a member recipe", () => {
  it("maps free-form units and quantities it understands", () => {
    expect([guessFoodUnit("gram"), guessFoodUnit("Lít"), guessFoodUnit("quả"), guessFoodUnit("hộp."), guessFoodUnit("muỗng canh")])
      .toEqual(["G", "L", "ITEM", "PACKAGE", null]);
    expect([guessQuantity("1,5"), guessQuantity("1/2"), guessQuantity("vừa đủ"), guessQuantity("0")]).toEqual(["1.5", "0.5", "", ""]);
  });

  it("fills name, servings, time, ingredients and steps; leaves nutrition for the Admin and flags unknown units", () => {
    const form = recipeFormFromMemberRecipe({
      name: "Canh chua tôm", servings: 30, minutes: 40,
      ingredients: [{ name: "Tôm", quantity: "300", unit: "g" }, { name: "Nước mắm", quantity: "2", unit: "muỗng canh" }],
      steps: ["Nấu nước dùng", "Cho tôm vào"],
    }, "  Món chua ngọt mùa hè  ");
    expect(form).toMatchObject({ name: "Canh chua tôm", description: "Món chua ngọt mùa hè", servings: "12", cookMinutes: "40", calories: "" });
    expect(form.ingredients.map(({ name, quantity, unit }) => [name, quantity, unit])).toEqual([["Tôm", "300", "G"], ["Nước mắm", "", "G"]]);
    expect(form.steps.map((step) => step.text)).toEqual(["Nấu nước dùng", "Cho tôm vào"]);
  });
});

describe("Admin: AI estimate applied to the prefilled form", () => {
  const recipe = {
    name: "Canh chua tôm", servings: 2, minutes: 30, steps: ["Nấu"],
    ingredients: [{ name: "tom su", quantity: "300", unit: "g" }, { name: "Me chua", quantity: "1", unit: "muỗng" }],
  };
  const estimate = {
    calories: 250, proteinG: 22, carbsG: 18, fatG: 6,
    ingredients: [{ original: "tom su", name: "Tôm sú", matched: true }, { original: "Me chua", name: "Me chua", matched: false }],
  };

  it("fills empty nutrition and renames untouched ingredient rows", () => {
    const form = applyRecipeEstimate(recipeFormFromMemberRecipe(recipe, ""), estimate);
    expect([form.calories, form.proteinG, form.carbsG, form.fatG]).toEqual(["250", "22", "18", "6"]);
    expect(form.ingredients.map((row) => row.name)).toEqual(["Tôm sú", "Me chua"]);
  });

  it("never overwrites what the Admin already typed while AI was answering", () => {
    const typed = { ...recipeFormFromMemberRecipe(recipe, ""), calories: "300" };
    typed.ingredients = [{ ...typed.ingredients[0], name: "Tôm thẻ" }, typed.ingredients[1]];
    const form = applyRecipeEstimate(typed, estimate);
    expect(form.calories).toBe("300");
    expect(form.ingredients[0].name).toBe("Tôm thẻ");
  });
});
