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

export async function publishCommunityPost(content: string) {
  return (await api.post<CommunityPost>("/community", { content })).data;
}

export async function toggleCommunityLike(postId: string) {
  return (await api.post<CommunityLikeResult>(`/community/${postId}/like`)).data;
}

export async function addCommunityComment({ postId, content }: AddCommunityCommentInput) {
  return (await api.post<CommunityComment>(`/community/${postId}/comments`, { content })).data;
}
