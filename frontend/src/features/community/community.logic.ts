import { searchRecipes, type SearchableRecipe } from "../recipes/recipe-search";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { CommunityPost, CommunityRecipeSummary, MemberRecipe, Recipe } from "../../types";

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

/** Thời gian đầy đủ (hiện khi rê chuột lên "5 phút trước"). */
export function communityExactTime(value: string) {
  return format(new Date(value), "HH:mm, dd/MM/yyyy");
}

/** Bài của chính người đang đăng nhập (so theo id tác giả, không theo tên). */
export function isOwnPost(post: Pick<CommunityPost, "author">, userId: string | undefined) {
  return Boolean(userId) && post.author.id === userId;
}

/** Hộp xác nhận "Xóa bài": nói rõ xóa cả ảnh, bình luận, lượt thích (khớp service xóa dùng chung ở backend). */
export function deletePostConfirm(post: Pick<CommunityPost, "images" | "commentCount" | "likeCount">) {
  const parts = [
    post.images.length ? `${post.images.length} ảnh` : null,
    `${post.commentCount} bình luận`,
    `${post.likeCount} lượt thích`,
  ].filter(Boolean).join(", ");
  return {
    title: "Xóa bài viết này?",
    description: `Bài viết sẽ bị xóa cùng ${parts} của bài. Không hoàn tác được.`,
    confirmLabel: "Xóa bài",
  };
}

export function normalizeCommunityContent(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

/**
 * Bài viết cần có chữ, công thức (món có sẵn hoặc tự viết) hoặc ảnh; trả về dữ liệu gửi API hoặc null nếu chưa đăng được.
 * Món có sẵn và công thức tự viết không đi cùng nhau (giao diện chỉ cho chọn một).
 */
export function toCommunityPublishInput(
  content: string, recipe: Pick<CommunityRecipeSummary, "id"> | null, images: File[] = [], memberRecipe: MemberRecipe | null = null,
) {
  const normalized = content.trim();
  if (!normalized && !recipe && !memberRecipe && !images.length) return null;
  return {
    content: normalized,
    ...(recipe ? { recipeId: recipe.id } : memberRecipe ? { memberRecipe } : {}),
    ...(images.length ? { images } : {}),
  };
}

// Kiểm tra trước khi gửi, khớp với backend (backend vẫn kiểm tra lại theo byte đầu file).
export const COMMUNITY_MAX_IMAGES = 4;
export const COMMUNITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const COMMUNITY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ImageCandidate = { name: string; type: string; size: number };

/** Thêm ảnh vừa chọn vào danh sách: bỏ ảnh sai định dạng, quá 5 MB hoặc vượt 4 ảnh, kèm lời báo lỗi đầu tiên gặp. */
export function addCommunityImages<T extends ImageCandidate>(current: T[], incoming: T[]) {
  const images = [...current];
  let error: string | null = null;
  for (const file of incoming) {
    if (!COMMUNITY_IMAGE_TYPES.includes(file.type)) error ??= `"${file.name}" không phải ảnh JPG, PNG hoặc WEBP.`;
    else if (file.size > COMMUNITY_IMAGE_MAX_BYTES) error ??= `"${file.name}" vượt quá 5 MB.`;
    else if (images.length >= COMMUNITY_MAX_IMAGES) error ??= `Mỗi bài tối đa ${COMMUNITY_MAX_IMAGES} ảnh.`;
    else images.push(file);
  }
  return { images, error };
}

export const COMMUNITY_RECIPE_PICKER_LIMIT = 8;

/** Lọc công thức cho ô chọn ở form đăng bài: cùng searchRecipes với mọi ô tìm món (lọc ở frontend; "Việc làm sau" trong CLAUDE.md). */
export function filterAttachableRecipes<T extends SearchableRecipe>(recipes: T[], query: string, limit = COMMUNITY_RECIPE_PICKER_LIMIT) {
  return searchRecipes(recipes, query).slice(0, limit);
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
