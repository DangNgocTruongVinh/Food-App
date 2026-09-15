import { api } from "../../api/client";
import type { ProfileResponse, ProfileUpdateInput } from "../../types";

export type ProfileFormValues = Record<
  "name" | "age" | "gender" | "heightCm" | "weightKg" | "targetWeightKg" |
  "activityLevel" | "goal" | "dietType" | "mealsPerDay" |
  "allergies" | "dislikedFoods" | "preferredCuisines", string
>;

const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function toProfileUpdate(form: ProfileFormValues): ProfileUpdateInput {
  return {
    ...form,
    age: form.age ? Number(form.age) : null,
    gender: form.gender as ProfileUpdateInput["gender"],
    heightCm: form.heightCm ? Number(form.heightCm) : null,
    weightKg: form.weightKg ? Number(form.weightKg) : null,
    targetWeightKg: form.targetWeightKg ? Number(form.targetWeightKg) : null,
    mealsPerDay: Number(form.mealsPerDay),
    allergies: split(form.allergies),
    dislikedFoods: split(form.dislikedFoods),
    preferredCuisines: split(form.preferredCuisines),
  };
}

export async function getProfile() {
  return (await api.get<ProfileResponse>("/profile")).data;
}

export async function updateProfile(input: ProfileUpdateInput) {
  return (await api.put<ProfileResponse>("/profile", input)).data;
}
