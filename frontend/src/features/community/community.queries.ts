import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import type { CommunityComment, CommunityPost } from "../../types";
import {
  addCommunityComment,
  deleteCommunityPost,
  listCommunityPosts,
  publishCommunityPost,
  toggleCommunityLike,
  updateCommunityPost,
  type CommunityLikeResult,
} from "./community.api";

export const communityQueries = {
  feed: () => queryOptions({ queryKey: queryKeys.community.feed(), queryFn: listCommunityPosts }),
};

export const communityMutations = {
  publish: () => mutationOptions({ mutationFn: publishCommunityPost }),
  toggleLike: () => mutationOptions({ mutationFn: toggleCommunityLike }),
  addComment: () => mutationOptions({ mutationFn: addCommunityComment }),
  remove: () => mutationOptions({ mutationFn: deleteCommunityPost }),
  update: () => mutationOptions({ mutationFn: updateCommunityPost }),
};

export function removeCommunityPost(queryClient: QueryClient, postId: string) {
  queryClient.setQueryData<CommunityPost[]>(queryKeys.community.feed(), (posts = []) => posts.filter((post) => post.id !== postId));
}

/** Bài vừa sửa thay đúng chỗ trong bảng tin (giữ bình luận, lượt thích từ phản hồi của backend). */
export function replaceCommunityPost(queryClient: QueryClient, post: CommunityPost) {
  queryClient.setQueryData<CommunityPost[]>(queryKeys.community.feed(), (posts = []) => posts.map((item) => (item.id === post.id ? post : item)));
}

export function prependCommunityPost(queryClient: QueryClient, post: CommunityPost) {
  queryClient.setQueryData<CommunityPost[]>(queryKeys.community.feed(), (posts = []) => [post, ...posts]);
}

export function updateCommunityLike(
  queryClient: QueryClient,
  postId: string,
  result: CommunityLikeResult,
) {
  queryClient.setQueryData<CommunityPost[]>(queryKeys.community.feed(), (posts = []) => posts.map((post) => (
    post.id === postId ? { ...post, likedByMe: result.liked, likeCount: result.likeCount } : post
  )));
}

export function appendCommunityComment(
  queryClient: QueryClient,
  postId: string,
  comment: CommunityComment,
) {
  queryClient.setQueryData<CommunityPost[]>(queryKeys.community.feed(), (posts = []) => posts.map((post) => (
    post.id === postId
      ? { ...post, comments: [...post.comments, comment], commentCount: post.commentCount + 1 }
      : post
  )));
}
