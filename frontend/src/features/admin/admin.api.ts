import { api } from "../../api/client";
import type { DietTag, FoodUnit, MealType } from "../../types";

export type AdminStats = {
  totals: { users: number; lockedUsers: number; mealPlans: number; posts: number; recipes: number; hiddenRecipes: number };
  weekly: Array<{ weekStart: string; users: number; mealPlans: number; posts: number }>;
  timeZone: string;
};

export type RecipeUsage = { mealPlanItems: number; posts: number };
export type AdminRecipeStatus = "all" | "visible" | "hidden";
export type AdminRecipeListQuery = { search?: string; status: AdminRecipeStatus; page: number; pageSize: number };

export type AdminRecipeSummary = {
  id: string; slug: string; name: string; imageUrl: string | null; calories: number; cuisine: string;
  dietTags: DietTag[]; mealTypes: MealType[]; hidden: boolean; usage: RecipeUsage; createdAt: string; updatedAt: string;
};
export type AdminRecipeList = { items: AdminRecipeSummary[]; total: number; page: number; pageSize: number };

export type AdminIngredientInput = { name: string; quantity: number; unit: FoodUnit; optional: boolean };
export type AdminRecipeInput = {
  name: string; description: string; instructions: string[]; prepMinutes: number; cookMinutes: number; servings: number;
  calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; cuisine: string;
  dietTags: DietTag[]; mealTypes: MealType[]; imageUrl?: string | null; ingredients: AdminIngredientInput[];
};
export type AdminRecipeDetail = AdminRecipeInput & {
  id: string; slug: string; imageUrl: string | null; hidden: boolean; usage: RecipeUsage;
  ingredients: Array<AdminIngredientInput & { id: string }>;
};

export async function getAdminStats() {
  return (await api.get<AdminStats>("/admin/stats")).data;
}

export async function listAdminRecipes(query: AdminRecipeListQuery) {
  const params = { ...query, search: query.search?.trim() || undefined };
  return (await api.get<AdminRecipeList>("/admin/recipes", { params })).data;
}

export async function getAdminRecipe(id: string) {
  return (await api.get<AdminRecipeDetail>(`/admin/recipes/${id}`)).data;
}

export async function createAdminRecipe(input: AdminRecipeInput) {
  return (await api.post<AdminRecipeDetail>("/admin/recipes", input)).data;
}

export async function updateAdminRecipe({ id, input }: { id: string; input: AdminRecipeInput }) {
  return (await api.put<AdminRecipeDetail>(`/admin/recipes/${id}`, input)).data;
}

export async function setAdminRecipeVisibility({ id, hidden }: { id: string; hidden: boolean }) {
  return (await api.patch<AdminRecipeDetail>(`/admin/recipes/${id}/visibility`, { hidden })).data;
}

/** Ảnh gửi dạng multipart (trường "image"); backend kiểm tra lại định dạng theo byte đầu file và dung lượng. */
export async function uploadAdminRecipeImage({ id, file }: { id: string; file: File }) {
  const form = new FormData();
  form.append("image", file, file.name);
  return (await api.put<AdminRecipeDetail>(`/admin/recipes/${id}/image`, form)).data;
}

export async function deleteAdminRecipe(id: string) {
  await api.delete(`/admin/recipes/${id}`);
}
