import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../api/client";
import CommunityHero from "../components/community/CommunityHero";
import { CommunityFeedEmpty, CommunityFeedError } from "../components/community/CommunityFeedStates";
import CommunitySidebar from "../components/community/CommunitySidebar";
import PostCard from "../components/community/PostCard";
import PostComposer, { COMMUNITY_POST_INPUT_ID } from "../components/community/PostComposer";
import RecipePicker from "../components/community/RecipePicker";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import {
  communityPostElementId,
  normalizeCommunityContent,
  SHARE_RECIPE_PARAM,
  toCommunityPublishInput,
  toCommunityRecipeSummary,
  toggleCommunitySelection,
} from "../features/community/community.logic";
import {
  appendCommunityComment,
  communityMutations,
  communityQueries,
  prependCommunityPost,
  updateCommunityLike,
} from "../features/community/community.queries";
import { recipeQueries } from "../features/recipes/recipes.queries";
import type { CommunityRecipeSummary } from "../types";

export default function CommunityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedPostId = searchParams.get("post");
  const shareRecipeId = searchParams.get(SHARE_RECIPE_PARAM);
  const [postContent, setPostContent] = useState("");
  const [attachedRecipe, setAttachedRecipe] = useState<CommunityRecipeSummary | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [savedPosts, setSavedPosts] = useState<Set<string>>(() => new Set());
  const [followedMembers, setFollowedMembers] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");

  const feed = useQuery(communityQueries.feed());
  const recipes = useQuery({ ...recipeQueries.list(), enabled: isPickerOpen });
  const sharedRecipe = useQuery({ ...recipeQueries.detail(shareRecipeId ?? ""), enabled: Boolean(shareRecipeId) });

  // `?shareRecipe=<id>` từ trang chi tiết công thức: gắn sẵn món vào form, đưa con trỏ vào ô nhập, rồi xóa tham số khỏi URL.
  useEffect(() => {
    if (!shareRecipeId || sharedRecipe.isPending) return;
    if (sharedRecipe.data) {
      setAttachedRecipe(toCommunityRecipeSummary(sharedRecipe.data));
      document.getElementById(COMMUNITY_POST_INPUT_ID)?.focus();
    } else {
      setError("Không tìm thấy công thức để chia sẻ.");
    }
    setSearchParams((params) => {
      params.delete(SHARE_RECIPE_PARAM);
      return params;
    }, { replace: true });
  }, [setSearchParams, shareRecipeId, sharedRecipe.data, sharedRecipe.isPending]);

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
      setAttachedRecipe(null);
      setPickerOpen(false);
      setRecipeQuery("");
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
    const input = toCommunityPublishInput(postContent, attachedRecipe);
    if (input) publish.mutate(input);
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
          <PostComposer
            userName={user?.name} value={postContent} onChange={setPostContent} onSubmit={submitPost} isPending={publish.isPending}
            canPublish={toCommunityPublishInput(postContent, attachedRecipe) !== null}
            attachedRecipe={attachedRecipe} onRemoveRecipe={() => setAttachedRecipe(null)}
            isPickerOpen={isPickerOpen} onTogglePicker={() => setPickerOpen((open) => !open)}
            picker={<RecipePicker
              recipes={recipes.data} isLoading={recipes.isLoading} isError={recipes.isError}
              query={recipeQuery} onQueryChange={setRecipeQuery} onClose={() => setPickerOpen(false)}
              onSelect={(recipe) => {
                setAttachedRecipe(toCommunityRecipeSummary(recipe));
                setPickerOpen(false);
                setRecipeQuery("");
              }}
            />}
          />

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
