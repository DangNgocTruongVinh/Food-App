import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../api/client";
import CommunityGuide from "../components/community/CommunityGuide";
import CommunityHero from "../components/community/CommunityHero";
import PostCard from "../components/community/PostCard";
import PostComposer, { COMMUNITY_POST_INPUT_ID } from "../components/community/PostComposer";
import RecipePicker from "../components/community/RecipePicker";
import { Button, EmptyState, ErrorState, LoadingState, Skeleton, Toast, useConfirm } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import {
  addCommunityImages, communityPostElementId, deletePostConfirm, isOwnPost, normalizeCommunityContent, SHARE_RECIPE_PARAM, shareRecipeError,
  toCommunityPublishInput, toCommunityRecipeSummary,
} from "../features/community/community.logic";
import {
  appendCommunityComment, communityMutations, communityQueries, prependCommunityPost, removeCommunityPost, updateCommunityLike,
} from "../features/community/community.queries";
import { recipeQueries } from "../features/recipes/recipes.queries";
import type { CommunityPost, CommunityRecipeSummary } from "../types";

// "Lưu bài", "Theo dõi" thành viên, chủ đề/thành viên nổi bật: chưa có dữ liệu thật, làm ở GĐ5.
export default function CommunityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedPostId = searchParams.get("post");
  const shareRecipeId = searchParams.get(SHARE_RECIPE_PARAM);
  const [postContent, setPostContent] = useState("");
  const [attachedRecipe, setAttachedRecipe] = useState<CommunityRecipeSummary | null>(null);
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  const feed = useQuery(communityQueries.feed());
  const recipes = useQuery({ ...recipeQueries.list(), enabled: isPickerOpen });
  const sharedRecipe = useQuery({ ...recipeQueries.detail(shareRecipeId ?? ""), enabled: Boolean(shareRecipeId) });

  // `?shareRecipe=<id>` từ trang chi tiết công thức: gắn sẵn món vào form, đưa con trỏ vào ô nhập, rồi xóa tham số khỏi URL.
  useEffect(() => {
    if (!shareRecipeId || sharedRecipe.isPending) return;
    const shareError = shareRecipeError(sharedRecipe.data);
    if (sharedRecipe.data && !shareError) {
      setAttachedRecipe(toCommunityRecipeSummary(sharedRecipe.data));
      document.getElementById(COMMUNITY_POST_INPUT_ID)?.focus();
    } else {
      setError(shareError ?? "");
    }
    setSearchParams((params) => {
      params.delete(SHARE_RECIPE_PARAM);
      return params;
    }, { replace: true });
  }, [setSearchParams, shareRecipeId, sharedRecipe.data, sharedRecipe.isPending]);

  // `?post=<id>` (link thông báo): cuộn tới bài và làm nổi bật.
  useEffect(() => {
    if (!focusedPostId || !feed.data) return;
    const frame = requestAnimationFrame(() => {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById(communityPostElementId(focusedPostId))?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [feed.data, focusedPostId]);

  const publish = useMutation({
    ...communityMutations.publish(),
    onSuccess: (post) => {
      prependCommunityPost(queryClient, post);
      setPostContent("");
      setAttachedRecipe(null);
      setAttachedImages([]);
      setImageError(null);
      setPickerOpen(false);
      setRecipeQuery("");
      setError("");
      setToast("Đã đăng bài.");
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
  const remove = useMutation({
    ...communityMutations.remove(),
    onSuccess: (_result, postId) => { removeCommunityPost(queryClient, postId); setToast("Đã xóa bài viết."); },
    onError: (removeError) => setError(getApiError(removeError)),
  });

  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    const input = toCommunityPublishInput(postContent, attachedRecipe, attachedImages);
    if (input) publish.mutate(input);
  };
  const submitComment = (event: FormEvent, postId: string) => {
    event.preventDefault();
    const content = normalizeCommunityContent(commentDrafts[postId] ?? "");
    if (content) addComment.mutate({ postId, content });
  };
  const confirmDelete = async (post: CommunityPost) => {
    if (await confirm({ ...deletePostConfirm(post), tone: "danger" })) remove.mutate(post.id);
  };

  return (
    <div className="cm-view">
      <CommunityHero />
      <div className="cm-layout">
        <div className="cm-main">
          <PostComposer
            userName={user?.name}
            value={postContent}
            onChange={setPostContent}
            onSubmit={submitPost}
            isPending={publish.isPending}
            canPublish={toCommunityPublishInput(postContent, attachedRecipe, attachedImages) !== null}
            images={attachedImages}
            imageError={imageError}
            onAddImages={(files) => {
              const result = addCommunityImages(attachedImages, files);
              setAttachedImages(result.images);
              setImageError(result.error);
            }}
            onRemoveImage={(index) => {
              setAttachedImages((images) => images.filter((_, position) => position !== index));
              setImageError(null);
            }}
            attachedRecipe={attachedRecipe}
            onRemoveRecipe={() => setAttachedRecipe(null)}
            isPickerOpen={isPickerOpen}
            onTogglePicker={() => setPickerOpen((open) => !open)}
            picker={(
              <RecipePicker
                recipes={recipes.data}
                isLoading={recipes.isLoading}
                isError={recipes.isError}
                query={recipeQuery}
                onQueryChange={setRecipeQuery}
                onClose={() => setPickerOpen(false)}
                onSelect={(recipe) => {
                  setAttachedRecipe(toCommunityRecipeSummary(recipe));
                  setPickerOpen(false);
                  setRecipeQuery("");
                }}
              />
            )}
            error={error ? <ErrorState message={error} /> : null}
          />

          <section className="cm-feed" aria-label="Bảng tin">
            {feed.isLoading && (
              <LoadingState label="Đang tải bài viết">
                {[0, 1].map((index) => <Skeleton key={index} kind="block" height={220} />)}
              </LoadingState>
            )}
            {feed.isError && (
              <ErrorState
                message={`Chưa tải được bảng tin. ${getApiError(feed.error)}`}
                onRetry={() => void feed.refetch()}
                retrying={feed.isFetching}
              />
            )}
            {feed.data?.length === 0 && (
              <EmptyState
                message="Chưa có bài viết nào. Hãy đăng món đầu tiên bạn nấu."
                action={<Button onClick={() => document.getElementById(COMMUNITY_POST_INPUT_ID)?.focus()}>Viết bài</Button>}
              />
            )}
            {feed.data?.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                userName={user?.name}
                isOwn={isOwnPost(post, user?.id)}
                isFocused={focusedPostId === post.id}
                isLikePending={toggleLike.isPending && toggleLike.variables === post.id}
                isCommentPending={addComment.isPending && addComment.variables?.postId === post.id}
                isDeleting={remove.isPending && remove.variables === post.id}
                commentDraft={commentDrafts[post.id] ?? ""}
                onToggleLike={() => toggleLike.mutate(post.id)}
                onDelete={() => void confirmDelete(post)}
                onCommentDraftChange={(value) => setCommentDrafts((drafts) => ({ ...drafts, [post.id]: value }))}
                onSubmitComment={(event) => submitComment(event, post.id)}
              />
            ))}
          </section>
        </div>
        <CommunityGuide />
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
