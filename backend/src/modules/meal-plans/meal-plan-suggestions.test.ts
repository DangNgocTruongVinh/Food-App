import { describe, expect, it } from "vitest";
import { mealPlanSuggestions, planAverages, planSuggestions, type SuggestionProfile } from "./meal-plan-suggestions.js";

// Chuyển từ frontend (features/meal-plans/meal-plans.test.ts) ở GĐ3b-R2, giữ nguyên các ca kiểm tra.
const profile = (overrides: NonNullable<SuggestionProfile> = {}): SuggestionProfile => ({ dietType: "BALANCED", allergies: [], dislikedFoods: [], ...overrides });
const fatSuggestion = (value: SuggestionProfile) => mealPlanSuggestions(value, { fiber: 30, fat: 40 }, 60)[1];

describe("Meal plan suggestions respect the profile", () => {
  it("suggests oily fish only when nothing in the profile rules it out", () => {
    expect(fatSuggestion(profile()).key).toBe("omega3-fish");
    expect(fatSuggestion(undefined).key).toBe("omega3-fish");
  });

  it.each([
    ["vegetarian", profile({ dietType: "VEGETARIAN" })],
    ["vegan", profile({ dietType: "VEGAN" })],
    ["seafood allergy", profile({ allergies: ["Hải sản"] })],
    ["fish allergy written differently", profile({ allergies: ["  CÁ  hồi "] })],
    ["disliked fish", profile({ dislikedFoods: ["cá"] })],
  ])("never suggests fish for %s", (_label, value) => {
    const suggestion = fatSuggestion(value);
    expect(suggestion.key).toBe("omega3-plant");
    expect(suggestion.text).not.toMatch(/\bcá\b|cá béo|cá hồi/i);
  });

  it("falls back to a neutral suggestion when plant sources are also restricted", () => {
    const suggestion = fatSuggestion(profile({ dietType: "VEGAN", allergies: ["Đậu nành"] }));
    expect(suggestion.key).toBe("fat-plant-oil");
    expect(suggestion.text).not.toMatch(/cá|đậu nành|óc chó/i);
  });

  it("does not mistake an unrelated allergy for fish (whole words: \"cà\" is not \"cá\")", () => {
    expect(fatSuggestion(profile({ allergies: ["Cà chua", "Đậu phộng"] })).key).toBe("omega3-fish");
  });

  it("states the plan's own numbers and keeps the reduce-fat advice free of fish", () => {
    const [fiber, fat] = mealPlanSuggestions(profile({ dietType: "VEGAN" }), { fiber: 10, fat: 80 }, 60);
    expect(fiber.text).toBe("Chất xơ trung bình 10 g mỗi ngày, dưới mức 30 g: thêm 1–2 khẩu phần rau xanh mỗi ngày.");
    expect(fat.key).toBe("fat-reduce");
    expect(fat.text).toBe("Chất béo trung bình 80 g mỗi ngày (mục tiêu 60 g): bớt món chiên, ưu tiên hấp, luộc, kho.");
    expect(fat.text).not.toMatch(/cá/);
  });

  it("skips the fat comparison when the profile has no target", () => {
    const [fiber, fat] = mealPlanSuggestions(undefined, { fiber: 31, fat: 90 }, null);
    expect(fiber.text).toBe("Chất xơ trung bình 31 g mỗi ngày, đạt mức 30 g.");
    expect(fat.key).toBe("omega3-fish");
    expect(fat.text).not.toContain("mục tiêu");
  });
});

describe("Plan averages and target from the stored profile", () => {
  const meal = (fiberG: number, fatG: number) => ({ recipe: { fiberG, fatG } });
  const plan = { days: [{ items: [meal(10, 30), meal(6, 20)] }, { items: [meal(8, 40)] }] };

  it("averages recipe fiber and fat per day (rounded), like the week summary", () => {
    expect(planAverages(plan)).toEqual({ fiber: 12, fat: 45 });
    expect(planAverages({ days: [] })).toEqual({ fiber: 0, fat: 0 });
  });

  it("uses the fat target only when the profile has computed targets", () => {
    expect(planSuggestions(plan, profile({ dailyCalorieTarget: 2000, fatTargetG: 40 }))[1].key).toBe("fat-reduce");
    expect(planSuggestions(plan, profile({ fatTargetG: 40 }))[1].text).not.toContain("mục tiêu");
    expect(planSuggestions(plan, null)[1].key).toBe("omega3-fish");
  });
});
