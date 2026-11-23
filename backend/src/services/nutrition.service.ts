import { NUTRITION_FORMULA as F } from "../shared/limits.js";

type NutritionInput = {
  age?: number | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityLevel?: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
  goal?: "LOSE_WEIGHT" | "MAINTAIN" | "GAIN_WEIGHT" | "BUILD_MUSCLE";
};

const activityFactor = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export function calculateNutritionTargets(profile: NutritionInput) {
  const age = profile.age ?? F.defaultBody.age;
  const height = profile.heightCm ?? F.defaultBody.heightCm;
  const weight = profile.weightKg ?? F.defaultBody.weightKg;
  const genderOffset = profile.gender === "MALE" ? 5 : profile.gender === "FEMALE" ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
  const tdee = bmr * activityFactor[profile.activityLevel ?? "MODERATE"];
  const calorieAdjustment = profile.goal === "LOSE_WEIGHT"
    ? F.calorieAdjustment.loseWeight
    : profile.goal === "GAIN_WEIGHT" || profile.goal === "BUILD_MUSCLE" ? F.calorieAdjustment.gainWeight : 0;
  const calories = Math.max(F.minCalories, Math.round(tdee + calorieAdjustment));
  const proteinRatio = profile.goal === "BUILD_MUSCLE" ? F.proteinRatio.buildMuscle : F.proteinRatio.default;
  const fatRatio = F.fatRatio;
  return {
    calories,
    proteinG: Math.round((calories * proteinRatio) / 4),
    carbsG: Math.round((calories * (1 - proteinRatio - fatRatio)) / 4),
    fatG: Math.round((calories * fatRatio) / 9),
  };
}

/** 4 chỉ tiêu lưu trong NutritionProfile; dùng chung cho cập nhật hồ sơ và seed. */
export function nutritionTargetFields(profile: NutritionInput) {
  const targets = calculateNutritionTargets(profile);
  return {
    dailyCalorieTarget: targets.calories,
    proteinTargetG: targets.proteinG,
    carbTargetG: targets.carbsG,
    fatTargetG: targets.fatG,
  };
}
