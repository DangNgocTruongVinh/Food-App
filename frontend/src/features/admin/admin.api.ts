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

// ---------- Người dùng, kiểm duyệt, nhật ký (UI-10) ----------

export type AdminUser = {
  id: string; name: string; email: string; role: "USER" | "ADMIN"; lockedAt: string | null; createdAt: string;
  locked: boolean; postCount: number; mealPlanCount: number;
};
export type AdminPage<T> = { items: T[]; total: number; page: number; pageSize: number };

export type ModerationPerson = { id: string; name: string; email: string };
export type ModerationPost = {
  id: string; content: string; createdAt: string; author: ModerationPerson;
  recipe: { id: string; name: string; imageUrl: string | null; calories: number; prepMinutes: number; cookMinutes: number; hidden?: boolean } | null;
  images: Array<{ url: string; position: number }>;
  comments: Array<{ id: string; content: string; createdAt: string; author: ModerationPerson }>;
  likeCount: number; commentCount: number;
};

export const AUDIT_ACTIONS = [
  "RECIPE_CREATE", "RECIPE_UPDATE", "RECIPE_HIDE", "RECIPE_SHOW", "RECIPE_DELETE", "RECIPE_IMAGE_REPLACE",
  "USER_LOCK", "USER_UNLOCK", "POST_DELETE", "COMMENT_DELETE",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditTargetType = "RECIPE" | "USER" | "COMMUNITY_POST" | "COMMUNITY_COMMENT";
export type AuditLog = {
  id: string; action: AuditAction; targetType: AuditTargetType; targetId: string; targetLabel: string | null;
  details: Record<string, unknown> | null; createdAt: string; actor: ModerationPerson;
};
export type AuditLogQuery = { action?: AuditAction; actorId?: string; page: number; pageSize: number };

export async function listAdminUsers(query: { search?: string; page: number; pageSize: number }) {
  return (await api.get<AdminPage<AdminUser>>("/admin/users", { params: { ...query, search: query.search?.trim() || undefined } })).data;
}

export async function setAdminUserLock({ id, locked }: { id: string; locked: boolean }) {
  return (await api.patch<{ id: string; lockedAt: string | null; locked: boolean }>(`/admin/users/${id}/lock`, { locked })).data;
}

export async function listModerationPosts(query: { page: number; pageSize: number }) {
  return (await api.get<AdminPage<ModerationPost>>("/admin/community/posts", { params: query })).data;
}

export async function moderateDeletePost(postId: string) {
  await api.delete(`/admin/community/posts/${postId}`);
}

export async function moderateDeleteComment(commentId: string) {
  await api.delete(`/admin/community/comments/${commentId}`);
}

export async function listAuditLogs(query: AuditLogQuery) {
  return (await api.get<AdminPage<AuditLog>>("/admin/audit-logs", { params: query })).data;
}
