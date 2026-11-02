import { api } from "../../api/client";
import type { ProfileResponse, ProfileUpdateInput } from "../../types";

export type ProfileFormValues = Record<
  "name" | "age" | "gender" | "heightCm" | "weightKg" | "targetWeightKg" | "activityLevel" | "goal" | "dietType" | "mealsPerDay", string
> & Record<"allergies" | "dislikedFoods" | "preferredCuisines", string[]>;

const clean = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
const numberOrNull = (value: string) => (value.trim() ? Number(value) : null);

export function toProfileUpdate(form: ProfileFormValues): ProfileUpdateInput {
  return {
    ...form,
    age: numberOrNull(form.age),
    gender: form.gender as ProfileUpdateInput["gender"],
    heightCm: numberOrNull(form.heightCm),
    weightKg: numberOrNull(form.weightKg),
    targetWeightKg: numberOrNull(form.targetWeightKg),
    mealsPerDay: Number(form.mealsPerDay),
    allergies: clean(form.allergies),
    dislikedFoods: clean(form.dislikedFoods),
    preferredCuisines: clean(form.preferredCuisines),
  };
}

export async function getProfile() {
  return (await api.get<ProfileResponse>("/profile")).data;
}

export async function updateProfile(input: ProfileUpdateInput) {
  return (await api.put<ProfileResponse>("/profile", input)).data;
}
