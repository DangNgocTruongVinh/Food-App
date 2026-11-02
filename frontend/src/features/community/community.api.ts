import { api } from "../../api/client";
import type { CommunityComment, CommunityPost } from "../../types";

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
  images?: File[];
}

/** Có ảnh thì gửi multipart (trường "images"), không có thì gửi JSON như trước. */
export async function publishCommunityPost({ content, recipeId, images = [] }: PublishCommunityPostInput) {
  if (!images.length) {
    return (await api.post<CommunityPost>("/community", { content, ...(recipeId ? { recipeId } : {}) })).data;
  }
  const form = new FormData();
  form.append("content", content);
  if (recipeId) form.append("recipeId", recipeId);
  for (const image of images) form.append("images", image, image.name);
  return (await api.post<CommunityPost>("/community", form)).data;
}

export async function toggleCommunityLike(postId: string) {
  return (await api.post<CommunityLikeResult>(`/community/${postId}/like`)).data;
}

/** "Xóa bài của tôi": backend chỉ cho tác giả xóa (bài người khác → 404), xóa cả ảnh, bình luận, lượt thích, thông báo. */
export async function deleteCommunityPost(postId: string) {
  await api.delete(`/community/${postId}`);
}

export async function addCommunityComment({ postId, content }: AddCommunityCommentInput) {
  return (await api.post<CommunityComment>(`/community/${postId}/comments`, { content })).data;
}
