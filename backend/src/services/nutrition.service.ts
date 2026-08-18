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
  const age = profile.age ?? 25;
  const height = profile.heightCm ?? 165;
  const weight = profile.weightKg ?? 60;
  const genderOffset = profile.gender === "MALE" ? 5 : profile.gender === "FEMALE" ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
  const tdee = bmr * activityFactor[profile.activityLevel ?? "MODERATE"];
  const calorieAdjustment = profile.goal === "LOSE_WEIGHT" ? -350 : profile.goal === "GAIN_WEIGHT" || profile.goal === "BUILD_MUSCLE" ? 300 : 0;
  const calories = Math.max(1200, Math.round(tdee + calorieAdjustment));
  const proteinRatio = profile.goal === "BUILD_MUSCLE" ? 0.3 : 0.25;
  const fatRatio = 0.28;
  return {
    calories,
    proteinG: Math.round((calories * proteinRatio) / 4),
    carbsG: Math.round((calories * (1 - proteinRatio - fatRatio)) / 4),
    fatG: Math.round((calories * fatRatio) / 9),
  };
}
