import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../api/client";
import CommunityHero from "../components/community/CommunityHero";
import { CommunityFeedEmpty, CommunityFeedError } from "../components/community/CommunityFeedStates";
import CommunitySidebar from "../components/community/CommunitySidebar";
import PostCard from "../components/community/PostCard";
import PostComposer from "../components/community/PostComposer";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import { communityPostElementId, normalizeCommunityContent, toggleCommunitySelection } from "../features/community/community.logic";
import {
  appendCommunityComment,
  communityMutations,
  communityQueries,
  prependCommunityPost,
  updateCommunityLike,
} from "../features/community/community.queries";

export default function CommunityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const focusedPostId = searchParams.get("post");
  const [postContent, setPostContent] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savedPosts, setSavedPosts] = useState<Set<string>>(() => new Set());
  const [followedMembers, setFollowedMembers] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");

  const feed = useQuery(communityQueries.feed());

  useEffect(() => {
    if (!focusedPostId || !feed.data) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(communityPostElementId(focusedPostId))?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [feed.data, focusedPostId]);

  const publish = useMutation({
    ...communityMutations.publish(),
    onSuccess: (post) => {
      prependCommunityPost(queryClient, post);
      setPostContent("");
      setError("");
    },
    onError: (publishError) => setError(getApiError(publishError)),
  });

  const toggleLike = useMutation({
    ...communityMutations.toggleLike(),
    onSuccess: (result, postId) => updateCommunityLike(queryClient, postId, result),
    onError: (likeError) => setError(getApiError(likeError)),
  });

  const addComment = useMutation({
    ...communityMutations.addComment(),
    onSuccess: (comment, { postId }) => {
      appendCommunityComment(queryClient, postId, comment);
      setCommentDrafts((drafts) => ({ ...drafts, [postId]: "" }));
      setError("");
    },
    onError: (commentError) => setError(getApiError(commentError)),
  });

  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    const content = normalizeCommunityContent(postContent);
    if (content) publish.mutate(content);
  };

  const submitComment = (event: FormEvent, postId: string) => {
    event.preventDefault();
    const content = normalizeCommunityContent(commentDrafts[postId] ?? "");
    if (content) addComment.mutate({ postId, content });
  };

  return (
    <div className="page community-page">
      <CommunityHero />

      <div className="community-layout">
        <main className="community-feed">
          <PostComposer userName={user?.name} value={postContent} onChange={setPostContent} onSubmit={submitPost} isPending={publish.isPending} />

          {error && <div className="form-error community-error">{error}</div>}
          {feed.isLoading && <LoadingState label="Đang tải bài viết..." />}
          {feed.isError && <CommunityFeedError message={getApiError(feed.error)} onRetry={() => feed.refetch()} />}
          {feed.data?.length === 0 && <CommunityFeedEmpty />}

          {feed.data?.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userName={user?.name}
              isFocused={focusedPostId === post.id}
              isSaved={savedPosts.has(post.id)}
              isLikePending={toggleLike.isPending && toggleLike.variables === post.id}
              isCommentPending={addComment.isPending && addComment.variables?.postId === post.id}
              commentDraft={commentDrafts[post.id] ?? ""}
              onToggleLike={() => toggleLike.mutate(post.id)}
              onToggleSaved={() => setSavedPosts((current) => toggleCommunitySelection(current, post.id))}
              onCommentDraftChange={(value) => setCommentDrafts((drafts) => ({ ...drafts, [post.id]: value }))}
              onSubmitComment={(event) => submitComment(event, post.id)}
            />
          ))}
        </main>

        <CommunitySidebar
          followedMembers={followedMembers}
          onToggleFollow={(name) => setFollowedMembers((current) => toggleCommunitySelection(current, name))}
        />
      </div>
    </div>
  );
}
