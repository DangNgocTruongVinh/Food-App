import { keepPreviousData, mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { retryUnlessClientError } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import {
  createAdminRecipe, deleteAdminRecipe, getAdminRecipe, getAdminStats, listAdminRecipes, setAdminRecipeVisibility, updateAdminRecipe,
  uploadAdminRecipeImage, type AdminRecipeListQuery, listAdminUsers, listAuditLogs, listModerationPosts, moderateDeleteComment,
  moderateDeletePost, setAdminUserLock, type AuditLogQuery, getModerationPost, setModerationPostVisibility,
} from "./admin.api";

export const adminQueries = {
  stats: () => queryOptions({ queryKey: queryKeys.admin.stats, queryFn: getAdminStats }),
  recipes: (query: AdminRecipeListQuery) => queryOptions({
    queryKey: queryKeys.admin.recipes(query), queryFn: () => listAdminRecipes(query), placeholderData: keepPreviousData,
  }),
  recipe: (id: string) => queryOptions({ queryKey: queryKeys.admin.recipe(id), queryFn: () => getAdminRecipe(id), retry: retryUnlessClientError }),
  users: (query: { search?: string; page: number; pageSize: number }) => queryOptions({
    queryKey: ["admin", "users", query] as const, queryFn: () => listAdminUsers(query), placeholderData: keepPreviousData,
  }),
  moderation: (query: { page: number; pageSize: number }) => queryOptions({
    queryKey: ["admin", "moderation", query] as const, queryFn: () => listModerationPosts(query), placeholderData: keepPreviousData,
  }),
  moderationPost: (postId: string) => queryOptions({
    queryKey: ["admin", "moderation", "post", postId] as const, queryFn: () => getModerationPost(postId), retry: retryUnlessClientError,
  }),
  auditLogs: (query: AuditLogQuery) => queryOptions({
    queryKey: ["admin", "audit-logs", query] as const, queryFn: () => listAuditLogs(query), placeholderData: keepPreviousData,
  }),
  /** Id món và tài khoản đang tồn tại (để nhật ký chỉ gắn link cho đối tượng còn), kèm danh sách Admin cho bộ lọc. */
  existing: () => queryOptions({ queryKey: ["admin", "existing"] as const, queryFn: loadExisting, staleTime: 60_000 }),
};

const PAGE = 50;
const MAX_PAGES = 10;
async function loadAll<T>(fetchPage: (page: number) => Promise<{ items: T[]; total: number }>) {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (items.length >= result.total || !result.items.length) break;
  }
  return items;
}
async function loadExisting() {
  const [recipes, users] = await Promise.all([
    loadAll((page) => listAdminRecipes({ status: "all", page, pageSize: PAGE })),
    loadAll((page) => listAdminUsers({ page, pageSize: PAGE })),
  ]);
  return {
    recipes: new Set(recipes.map((recipe) => recipe.id)),
    users: new Set(users.map((user) => user.id)),
    admins: users.filter((user) => user.role === "ADMIN").map(({ id, name, email }) => ({ id, name, email })),
  };
}

export const adminMutations = {
  createRecipe: () => mutationOptions({ mutationFn: createAdminRecipe }),
  updateRecipe: () => mutationOptions({ mutationFn: updateAdminRecipe }),
  setVisibility: () => mutationOptions({ mutationFn: setAdminRecipeVisibility }),
  uploadImage: () => mutationOptions({ mutationFn: uploadAdminRecipeImage }),
  deleteRecipe: () => mutationOptions({ mutationFn: deleteAdminRecipe }),
  setUserLock: () => mutationOptions({ mutationFn: setAdminUserLock }),
  deletePost: () => mutationOptions({ mutationFn: moderateDeletePost }),
  setPostVisibility: () => mutationOptions({ mutationFn: setModerationPostVisibility }),
  deleteComment: () => mutationOptions({ mutationFn: moderateDeleteComment }),
};

/** Sau thao tác Admin (khóa, kiểm duyệt): làm mới mọi dữ liệu Admin (danh sách, thống kê, nhật ký) và bảng tin cộng đồng. */
export function invalidateAdminQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.community.all });
}

/** Sau khi đổi công thức: làm mới danh sách/thống kê Admin và mọi dữ liệu công thức phía người dùng. */
export function invalidateAdminRecipeQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}
