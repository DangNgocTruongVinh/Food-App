import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import type { CommunityComment, CommunityPost } from "../../types";
import {
  addCommunityComment,
  deleteCommunityPost,
  listCommunityPosts,
  listSavedCommunityPosts,
  publishCommunityPost,
  setCommunityPostSaved,
  toggleCommunityLike,
  updateCommunityPost,
  type CommunityLikeResult,
} from "./community.api";

export const communityQueries = {
  feed: () => queryOptions({ queryKey: queryKeys.community.feed(), queryFn: listCommunityPosts }),
  saved: () => queryOptions({ queryKey: queryKeys.community.saved(), queryFn: listSavedCommunityPosts }),
};

export const communityMutations = {
  publish: () => mutationOptions({ mutationFn: publishCommunityPost }),
  toggleLike: () => mutationOptions({ mutationFn: toggleCommunityLike }),
  addComment: () => mutationOptions({ mutationFn: addCommunityComment }),
  remove: () => mutationOptions({ mutationFn: deleteCommunityPost }),
  update: () => mutationOptions({ mutationFn: updateCommunityPost }),
  save: () => mutationOptions({ mutationFn: setCommunityPostSaved }),
};

/** Áp cùng một thay đổi cho bảng tin và "Bài đã lưu" (cùng dạng bài viết). */
function updatePostLists(queryClient: QueryClient, change: (posts: CommunityPost[]) => CommunityPost[]) {
  for (const key of [queryKeys.community.feed(), queryKeys.community.saved()]) {
    queryClient.setQueryData<CommunityPost[]>(key, (posts) => (posts ? change(posts) : posts));
  }
}

/** UC25: bật/tắt lưu — cập nhật cờ ở bảng tin; bỏ lưu thì bài rời "Bài đã lưu", lưu mới thì tải lại danh sách đó. */
export function updateCommunitySaved(queryClient: QueryClient, postId: string, saved: boolean) {
  updatePostLists(queryClient, (posts) => posts.map((post) => (post.id === postId ? { ...post, savedByMe: saved } : post)));
  if (saved) void queryClient.invalidateQueries({ queryKey: queryKeys.community.saved() });
  else queryClient.setQueryData<CommunityPost[]>(queryKeys.community.saved(), (posts) => posts?.filter((post) => post.id !== postId));
}

export function removeCommunityPost(queryClient: QueryClient, postId: string) {
  updatePostLists(queryClient, (posts) => posts.filter((post) => post.id !== postId));
}

/** Bài vừa sửa thay đúng chỗ trong bảng tin (giữ bình luận, lượt thích từ phản hồi của backend). */
export function replaceCommunityPost(queryClient: QueryClient, post: CommunityPost) {
  updatePostLists(queryClient, (posts) => posts.map((item) => (item.id === post.id ? post : item)));
}

export function prependCommunityPost(queryClient: QueryClient, post: CommunityPost) {
  queryClient.setQueryData<CommunityPost[]>(queryKeys.community.feed(), (posts = []) => [post, ...posts]);
}

export function updateCommunityLike(
  queryClient: QueryClient,
  postId: string,
  result: CommunityLikeResult,
) {
  updatePostLists(queryClient, (posts) => posts.map((post) => (
    post.id === postId ? { ...post, likedByMe: result.liked, likeCount: result.likeCount } : post
  )));
}

export function appendCommunityComment(
  queryClient: QueryClient,
  postId: string,
  comment: CommunityComment,
) {
  updatePostLists(queryClient, (posts) => posts.map((post) => (
    post.id === postId
      ? { ...post, comments: [...post.comments, comment], commentCount: post.commentCount + 1 }
      : post
  )));
}
