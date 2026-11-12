import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../api/client";
import CommunityGuide from "../components/community/CommunityGuide";
import CommunityHero from "../components/community/CommunityHero";
import EditPostDialog from "../components/community/EditPostDialog";
import MemberRecipeFields from "../components/community/MemberRecipeFields";
import PostCard from "../components/community/PostCard";
import PostComposer, { COMMUNITY_POST_INPUT_ID } from "../components/community/PostComposer";
import RecipePicker from "../components/community/RecipePicker";
import { Button, ChoiceGroup, EmptyState, ErrorState, LoadingState, Skeleton, Toast, useConfirm } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import {
  addCommunityImages, communityPostElementId, deletePostConfirm, isOwnPost, normalizeCommunityContent, SHARE_RECIPE_PARAM, shareRecipeError,
  toCommunityPublishInput, toCommunityRecipeSummary,
} from "../features/community/community.logic";
import {
  appendCommunityComment, communityMutations, communityQueries, prependCommunityPost, removeCommunityPost, replaceCommunityPost,
  updateCommunityLike, updateCommunitySaved,
} from "../features/community/community.queries";
import { emptyMemberRecipeDraft, toMemberRecipe, type MemberRecipeDraft } from "../features/community/member-recipe.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";
import type { CommunityPost, CommunityRecipeSummary } from "../types";

const VIEW_OPTIONS = [["feed", "Bảng tin"], ["saved", "Bài đã lưu"]] as const;

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
  // Công thức tự viết (null: không viết); loại trừ với món có sẵn.
  const [memberDraft, setMemberDraft] = useState<MemberRecipeDraft | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editError, setEditError] = useState("");
  const [recipeQuery, setRecipeQuery] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  const feed = useQuery(communityQueries.feed());
  // UC25: "Bảng tin" hoặc "Bài đã lưu" (chỉ bài của chính mình đã lưu; bài bị ẩn/xóa tự biến mất).
  const [view, setView] = useState<"feed" | "saved">("feed");
  const saved = useQuery({ ...communityQueries.saved(), enabled: view === "saved" });
  const list = view === "saved" ? saved : feed;
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
      setMemberDraft(null);
      setMemberError(null);
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

  const save = useMutation({
    ...communityMutations.save(),
    onSuccess: (result) => { updateCommunitySaved(queryClient, result.postId, result.saved); setToast(result.saved ? "Đã lưu bài." : "Đã bỏ lưu bài."); },
    onError: (saveError) => setError(getApiError(saveError)),
  });

  const update = useMutation({
    ...communityMutations.update(),
    onSuccess: (post) => { replaceCommunityPost(queryClient, post); setEditingPost(null); setEditError(""); setToast("Đã lưu bài viết."); },
    onError: (updateError) => setEditError(getApiError(updateError)),
  });

  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    const member = memberDraft ? toMemberRecipe(memberDraft) : null;
    if (member && "error" in member) return setMemberError(member.error);
    setMemberError(null);
    const input = toCommunityPublishInput(postContent, attachedRecipe, attachedImages, member?.recipe ?? null);
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
            canPublish={Boolean(memberDraft) || toCommunityPublishInput(postContent, attachedRecipe, attachedImages) !== null}
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
            onTogglePicker={() => { setPickerOpen((open) => !open); setMemberDraft(null); setMemberError(null); }}
            isWriting={Boolean(memberDraft)}
            onToggleWriting={() => {
              setMemberDraft((current) => (current ? null : emptyMemberRecipeDraft()));
              setMemberError(null);
              setAttachedRecipe(null);
              setPickerOpen(false);
            }}
            memberFields={memberDraft && (
              <MemberRecipeFields
                idPrefix="new-post"
                draft={memberDraft}
                onChange={setMemberDraft}
                onRemove={() => { setMemberDraft(null); setMemberError(null); }}
                error={memberError}
              />
            )}
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
                  setMemberDraft(null);
                  setPickerOpen(false);
                  setRecipeQuery("");
                }}
              />
            )}
            error={error ? <ErrorState message={error} /> : null}
          />

          <ChoiceGroup
            legend="Hiển thị" name="community-view" className="cm-view-switch" options={VIEW_OPTIONS} value={view}
            onChange={(value) => setView(value === "saved" ? "saved" : "feed")}
          />
          <section className="cm-feed" aria-label={view === "saved" ? "Bài đã lưu" : "Bảng tin"}>
            {list.isLoading && (
              <LoadingState label="Đang tải bài viết">
                {[0, 1].map((index) => <Skeleton key={index} kind="block" height={220} />)}
              </LoadingState>
            )}
            {list.isError && (
              <ErrorState
                message={`Chưa tải được ${view === "saved" ? "bài đã lưu" : "bảng tin"}. ${getApiError(list.error)}`}
                onRetry={() => void list.refetch()}
                retrying={list.isFetching}
              />
            )}
            {list.data?.length === 0 && (view === "saved" ? (
              <EmptyState message="Bạn chưa lưu bài nào. Bấm “Lưu” dưới một bài để đọc lại sau." />
            ) : (
              <EmptyState
                message="Chưa có bài viết nào. Hãy đăng món đầu tiên bạn nấu."
                action={<Button onClick={() => document.getElementById(COMMUNITY_POST_INPUT_ID)?.focus()}>Viết bài</Button>}
              />
            ))}
            {list.data?.map((post) => (
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
                isSavePending={save.isPending && save.variables?.postId === post.id}
                onToggleSave={() => save.mutate({ postId: post.id, saved: !post.savedByMe })}
                onDelete={() => void confirmDelete(post)}
                onEdit={() => { setEditError(""); setEditingPost(post); }}
                onCommentDraftChange={(value) => setCommentDrafts((drafts) => ({ ...drafts, [post.id]: value }))}
                onSubmitComment={(event) => submitComment(event, post.id)}
              />
            ))}
          </section>
        </div>
        <CommunityGuide />
      </div>
      {editingPost && (
        <EditPostDialog
          post={editingPost}
          busy={update.isPending}
          error={editError}
          onClose={() => setEditingPost(null)}
          onSave={(input) => update.mutate({ postId: editingPost.id, ...input })}
        />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
