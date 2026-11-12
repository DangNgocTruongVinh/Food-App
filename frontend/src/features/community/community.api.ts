import { api } from "../../api/client";
import type { CommunityComment, CommunityPost, MemberRecipe } from "../../types";

export interface CommunityLikeResult {
  liked: boolean;
  likeCount: number;
}

export interface AddCommunityCommentInput {
  postId: string;
  content: string;
}

export async function listCommunityPosts() {
  return (await api.get<CommunityPost[]>("/community")).data;
}

export interface PublishCommunityPostInput {
  content: string;
  recipeId?: string;
  /** Công thức tự viết (không đi cùng recipeId). */
  memberRecipe?: MemberRecipe;
  images?: File[];
}

/** Có ảnh thì gửi multipart (trường "images"; công thức tự viết là chuỗi JSON), không có thì gửi JSON như trước. */
export async function publishCommunityPost({ content, recipeId, memberRecipe, images = [] }: PublishCommunityPostInput) {
  if (!images.length) {
    return (await api.post<CommunityPost>("/community", { content, ...(recipeId ? { recipeId } : {}), ...(memberRecipe ? { memberRecipe } : {}) })).data;
  }
  const form = new FormData();
  form.append("content", content);
  if (recipeId) form.append("recipeId", recipeId);
  if (memberRecipe) form.append("memberRecipe", JSON.stringify(memberRecipe));
  for (const image of images) form.append("images", image, image.name);
  return (await api.post<CommunityPost>("/community", form)).data;
}

/** Sửa bài của tôi: nội dung và công thức tự viết (null = bỏ). Backend chỉ cho tác giả (bài người khác → 404). */
export async function updateCommunityPost({ postId, content, memberRecipe }: { postId: string; content: string; memberRecipe: MemberRecipe | null }) {
  return (await api.patch<CommunityPost>(`/community/${postId}`, { content, memberRecipe })).data;
}

export async function toggleCommunityLike(postId: string) {
  return (await api.post<CommunityLikeResult>(`/community/${postId}/like`)).data;
}

/** "Xóa bài của tôi": backend chỉ cho tác giả xóa (bài người khác → 404), xóa cả ảnh, bình luận, lượt thích, thông báo. */
export async function deleteCommunityPost(postId: string) {
  await api.delete(`/community/${postId}`);
}

/** UC25: bài đã lưu của chính người dùng (bài bị ẩn / chờ duyệt / đã xóa không còn trong danh sách). */
export async function listSavedCommunityPosts() {
  return (await api.get<CommunityPost[]>("/community/saved")).data;
}

/** Lưu (PUT) / bỏ lưu (DELETE) bài; gọi lại vẫn cùng kết quả. */
export async function setCommunityPostSaved({ postId, saved }: { postId: string; saved: boolean }) {
  const response = saved ? await api.put(`/community/${postId}/save`) : await api.delete(`/community/${postId}/save`);
  return response.data as { postId: string; saved: boolean };
}

export async function addCommunityComment({ postId, content }: AddCommunityCommentInput) {
  return (await api.post<CommunityComment>(`/community/${postId}/comments`, { content })).data;
}
