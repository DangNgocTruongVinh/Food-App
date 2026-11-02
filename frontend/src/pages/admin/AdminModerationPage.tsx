import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { getApiError } from "../../api/client";
import { AdminPager } from "../../components/admin/AdminListParts";
import PostImages from "../../components/community/PostImages";
import RecipeAttachmentCard from "../../components/community/RecipeAttachmentCard";
import { Button, Card, EmptyState, ErrorState, LoadingState, Skeleton, Toast, useConfirm } from "../../components/ui";
import type { ModerationPost } from "../../features/admin/admin.api";
import { deleteCommentConfirmText, deletePostConfirmText, vietnamTime } from "../../features/admin/admin-people.logic";
import { adminMutations, adminQueries, invalidateAdminQueries } from "../../features/admin/admin.queries";
import { communityRelativeTime } from "../../features/community/community.logic";

const PAGE_SIZE = 10;

function Time({ value }: { value: string }) {
  return <time className="ad-sub" dateTime={value} title={vietnamTime(value)}>{communityRelativeTime(value)}, {vietnamTime(value)}</time>;
}

/** /admin/moderation: bài mới nhất (tác giả, thời gian thật, nội dung, ảnh, công thức, lượt thích, bình luận); xóa bài/bình luận. */
export default function AdminModerationPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const list = useQuery(adminQueries.moderation({ page, pageSize: PAGE_SIZE }));
  const removePost = useMutation({ ...adminMutations.deletePost(), onSuccess: () => invalidateAdminQueries(queryClient) });
  const removeComment = useMutation({ ...adminMutations.deleteComment(), onSuccess: () => invalidateAdminQueries(queryClient) });

  const deletePost = async (post: ModerationPost) => {
    setActionError("");
    if (!(await confirm({ ...deletePostConfirmText(post), tone: "danger" }))) return;
    removePost.mutate(post.id, {
      onSuccess: () => setToast(`Đã xóa bài của ${post.author.name}.`),
      onError: (error) => setActionError(`Chưa xóa được bài: ${getApiError(error)}`),
    });
  };
  const deleteComment = async (comment: ModerationPost["comments"][number]) => {
    setActionError("");
    if (!(await confirm({ ...deleteCommentConfirmText(comment), tone: "danger" }))) return;
    removeComment.mutate(comment.id, {
      onSuccess: () => setToast(`Đã xóa bình luận của ${comment.author.name}.`),
      onError: (error) => setActionError(`Chưa xóa được bình luận: ${getApiError(error)}`),
    });
  };

  const data = list.data;
  return (
    <section className="ad-section" aria-labelledby="ad-moderation-title">
      <h2 id="ad-moderation-title" className="ad-section__title">Kiểm duyệt cộng đồng</h2>
      {actionError && <ErrorState message={actionError} />}
      {list.isLoading ? (
        <LoadingState label="Đang tải bài viết">{[0, 1].map((index) => <Skeleton key={index} kind="block" height={220} />)}</LoadingState>
      ) : list.isError || !data ? (
        <ErrorState message="Chưa tải được bài viết." onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : !data.items.length ? (
        <Card><EmptyState message="Cộng đồng chưa có bài viết nào để kiểm duyệt." /></Card>
      ) : (
        <>
          <ol className="ad-posts">
            {data.items.map((post) => (
              <li key={post.id}>
                <Card as="article" className="ad-post" aria-label={`Bài của ${post.author.name}`}>
                  <header className="ad-post__head">
                    <div className="ad-post__who">
                      <span className="ad-row__strong">{post.author.name}</span>
                      <span className="ad-sub">{post.author.email}</span>
                      <Time value={post.createdAt} />
                    </div>
                    <Button
                      variant="danger"
                      icon={<Trash2 />}
                      busy={removePost.isPending && removePost.variables === post.id}
                      aria-label={`Xóa bài của ${post.author.name}`}
                      onClick={() => void deletePost(post)}
                    >
                      Xóa bài
                    </Button>
                  </header>
                  {post.content ? <p className="ad-post__content">{post.content}</p> : <p className="ad-sub">Bài không có chữ.</p>}
                  <PostImages images={post.images} authorName={post.author.name} />
                  {post.recipe && <RecipeAttachmentCard recipe={post.recipe} />}
                  <p className="ad-post__stats"><span>{post.likeCount} lượt thích</span><span>{post.commentCount} bình luận</span></p>
                  {post.comments.length > 0 && (
                    <ul className="ad-comments" aria-label="Bình luận">
                      {post.comments.map((comment) => (
                        <li key={comment.id} className="ad-comment">
                          <div className="ad-comment__body">
                            <p className="ad-comment__head">
                              <span className="ad-row__strong">{comment.author.name}</span>
                              <span className="ad-sub">{comment.author.email}</span>
                              <Time value={comment.createdAt} />
                            </p>
                            <p className="ad-comment__text">{comment.content}</p>
                          </div>
                          <Button
                            variant="danger"
                            busy={removeComment.isPending && removeComment.variables === comment.id}
                            aria-label={`Xóa bình luận của ${comment.author.name}`}
                            onClick={() => void deleteComment(comment)}
                          >
                            Xóa
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            ))}
          </ol>
          <Card variant="flush" className="ad-posts__pager">
            <AdminPager
              label="Phân trang bài viết" summary={`${data.total} bài viết`}
              page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage}
            />
          </Card>
        </>
      )}
      <Toast message={toast} onDone={clearToast} />
    </section>
  );
}
