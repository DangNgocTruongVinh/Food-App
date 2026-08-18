import { describe, expect, it } from "vitest";
import { calculateNutritionTargets } from "./nutrition.service.js";

describe("calculateNutritionTargets", () => {
  it("tăng năng lượng cho mục tiêu tăng cơ", () => {
    const maintain = calculateNutritionTargets({ age: 25, gender: "MALE", heightCm: 175, weightKg: 70, activityLevel: "MODERATE", goal: "MAINTAIN" });
    const muscle = calculateNutritionTargets({ age: 25, gender: "MALE", heightCm: 175, weightKg: 70, activityLevel: "MODERATE", goal: "BUILD_MUSCLE" });
    expect(muscle.calories).toBeGreaterThan(maintain.calories);
    expect(muscle.proteinG).toBeGreaterThan(maintain.proteinG);
  });

  it("không đưa mục tiêu calo xuống dưới ngưỡng an toàn của ứng dụng", () => {
    expect(calculateNutritionTargets({ age: 80, gender: "FEMALE", heightCm: 140, weightKg: 35, activityLevel: "SEDENTARY", goal: "LOSE_WEIGHT" }).calories).toBe(1200);
  });
});
