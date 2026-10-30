import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { CommunityPost, CommunityRecipeSummary, Recipe } from "../../types";

export const suggestedTopics = [
  { label: "Bữa ăn hôm nay", count: 128 },
  { label: "Mẹo bảo quản", count: 86 },
  { label: "Công thức lành mạnh", count: 256 },
  { label: "Hành trình của tôi", count: 112 },
];

export const featuredMembers = [
  { name: "Linh Nhi", role: "Chuyên gia dinh dưỡng" },
  { name: "Minh An", role: "Thành viên tích cực" },
];

export const COMMUNITY_POST_MAX_LENGTH = 2000;
export const COMMUNITY_COMMENT_MAX_LENGTH = 500;

/** id phần tử bài viết: link thông báo `/community?post=<id>` cuộn tới phần tử này. */
export function communityPostElementId(postId: string) {
  return `post-${postId}`;
}

/** id ô bình luận của bài viết: nút "Bình luận" đưa con trỏ vào ô này. */
export function communityCommentInputId(postId: string) {
  return `comment-${postId}`;
}

export function communityInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0).toUpperCase()).join("");
}

export function communityRelativeTime(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: vi });
}

export function normalizeCommunityContent(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

/** Bài viết cần có chữ hoặc công thức đính kèm; trả về dữ liệu gửi API hoặc null nếu chưa đăng được. */
export function toCommunityPublishInput(content: string, recipe: Pick<CommunityRecipeSummary, "id"> | null) {
  const normalized = content.trim();
  if (!normalized && !recipe) return null;
  return { content: normalized, ...(recipe ? { recipeId: recipe.id } : {}) };
}

export const COMMUNITY_RECIPE_PICKER_LIMIT = 8;

/** Chuẩn hóa để tìm theo tên không phân biệt hoa thường/dấu: "Cá kho" và "ca kho" đều khớp. */
export function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Lọc công thức cho ô chọn ở form đăng bài (lọc ở frontend; xem "Việc làm sau" trong CLAUDE.md). */
export function filterAttachableRecipes<T extends Pick<Recipe, "name">>(recipes: T[], query: string, limit = COMMUNITY_RECIPE_PICKER_LIMIT) {
  const normalized = normalizeSearchText(query);
  return recipes.filter((recipe) => !normalized || normalizeSearchText(recipe.name).includes(normalized)).slice(0, limit);
}

export function toCommunityRecipeSummary(recipe: Pick<Recipe, "id" | "name" | "imageUrl" | "calories" | "prepMinutes" | "cookMinutes">) {
  const { id, name, imageUrl, calories, prepMinutes, cookMinutes } = recipe;
  return { id, name, imageUrl: imageUrl ?? null, calories, prepMinutes, cookMinutes } satisfies CommunityRecipeSummary;
}

/** Tham số `/community?shareRecipe=<id>`: nút "Chia sẻ lên cộng đồng" ở trang chi tiết công thức. */
export const SHARE_RECIPE_PARAM = "shareRecipe";

export const HIDDEN_RECIPE_MESSAGE = "Món này đã ngừng sử dụng.";

/** Lý do không gắn được món từ `?shareRecipe=`: không tìm thấy hoặc món đã ngừng sử dụng; gắn được thì null. */
export function shareRecipeError(recipe: Pick<Recipe, "hidden"> | undefined) {
  if (!recipe) return "Không tìm thấy công thức để chia sẻ.";
  return recipe.hidden ? HIDDEN_RECIPE_MESSAGE : null;
}

export function communityShareRecipePath(recipeId: string) {
  return `/community?${SHARE_RECIPE_PARAM}=${encodeURIComponent(recipeId)}`;
}

/** Chữ dùng khi chia sẻ bài ra ngoài: bài chỉ có công thức thì dùng tên món. */
export function communityShareText(post: Pick<CommunityPost, "content" | "recipe">) {
  if (post.content) return post.content;
  return post.recipe ? `Công thức: ${post.recipe.name}` : "";
}

export function toggleCommunitySelection(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface CommunityShareTarget {
  share?: (data?: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

export async function shareCommunityPost(
  post: CommunityPost,
  target: CommunityShareTarget = navigator,
) {
  try {
    if (target.share) {
      await target.share({ title: `Bài viết của ${post.author.name}`, text: communityShareText(post) });
    } else {
      await target.clipboard?.writeText(communityShareText(post));
    }
  } catch {
    // Người dùng có thể đóng hộp thoại chia sẻ mà không thực hiện hành động.
  }
}
