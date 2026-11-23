import { describe, expect, it } from "vitest";
import { calculateNutritionTargets, nutritionTargetFields } from "./nutrition.service.js";

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

describe("nutritionTargetFields", () => {
  it("maps calculateNutritionTargets to the four stored profile fields", () => {
    const profile = { age: 24, gender: "FEMALE" as const, heightCm: 162, weightKg: 55, activityLevel: "MODERATE" as const, goal: "MAINTAIN" as const };
    const targets = calculateNutritionTargets(profile);
    expect(nutritionTargetFields(profile)).toEqual({
      dailyCalorieTarget: targets.calories, proteinTargetG: targets.proteinG, carbTargetG: targets.carbsG, fatTargetG: targets.fatG,
    });
  });
});

// Audit M1: số của công thức gom vào shared/limits.ts (NUTRITION_FORMULA); kết quả phải giống hệt bản viết số trực tiếp trước đó.
describe("calculateNutritionTargets sau khi gom số vào NUTRITION_FORMULA (audit M1)", () => {
  const factor = { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, VERY_ACTIVE: 1.9 };
  // Bản chép nguyên văn công thức trước khi sửa.
  function before(profile: Parameters<typeof calculateNutritionTargets>[0]) {
    const age = profile.age ?? 25;
    const height = profile.heightCm ?? 165;
    const weight = profile.weightKg ?? 60;
    const genderOffset = profile.gender === "MALE" ? 5 : profile.gender === "FEMALE" ? -161 : -78;
    const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
    const tdee = bmr * factor[profile.activityLevel ?? "MODERATE"];
    const calorieAdjustment = profile.goal === "LOSE_WEIGHT" ? -350 : profile.goal === "GAIN_WEIGHT" || profile.goal === "BUILD_MUSCLE" ? 300 : 0;
    const calories = Math.max(1200, Math.round(tdee + calorieAdjustment));
    const proteinRatio = profile.goal === "BUILD_MUSCLE" ? 0.3 : 0.25;
    return {
      calories,
      proteinG: Math.round((calories * proteinRatio) / 4),
      carbsG: Math.round((calories * (1 - proteinRatio - 0.28)) / 4),
      fatG: Math.round((calories * 0.28) / 9),
    };
  }

  it("cùng kết quả trên lưới tuổi × giới tính × chiều cao × cân nặng × vận động × mục tiêu, kể cả khi thiếu số đo", () => {
    let cases = 0;
    for (const age of [null, 13, 25, 47, 80, 120]) {
      for (const gender of [null, "MALE", "FEMALE", "OTHER"] as const) {
        for (const heightCm of [null, 100, 158, 165, 190, 250]) {
          for (const weightKg of [null, 25, 52.5, 60, 95, 400]) {
            for (const activityLevel of [undefined, ...Object.keys(factor)] as Array<keyof typeof factor | undefined>) {
              for (const goal of [undefined, "LOSE_WEIGHT", "MAINTAIN", "GAIN_WEIGHT", "BUILD_MUSCLE"] as const) {
                const profile = { age, gender, heightCm, weightKg, activityLevel, goal };
                expect(calculateNutritionTargets(profile)).toEqual(before(profile));
                cases += 1;
              }
            }
          }
        }
      }
    }
    expect(cases).toBe(6 * 4 * 6 * 6 * 6 * 5);
  });
});
