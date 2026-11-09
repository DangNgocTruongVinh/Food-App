import { Heart, MessageCircle, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import {
  communityCommentInputId, communityExactTime, communityInitials, communityPostElementId, communityRelativeTime, shareCommunityPost,
} from "../../features/community/community.logic";
import { useDisclosure } from "../../features/layout/useDisclosure";
import { cx } from "../../features/ui/ui.logic";
import type { CommunityPost } from "../../types";
import { Card, Tag } from "../ui";
import CommentForm from "./CommentForm";
import PostImages from "./PostImages";
import RecipeAttachmentCard from "./RecipeAttachmentCard";

type PostCardProps = {
  post: CommunityPost;
  userName?: string;
  /** Bài của người đang đăng nhập: có menu "…" với "Xóa bài". */
  isOwn: boolean;
  isFocused: boolean;
  isLikePending: boolean;
  isCommentPending: boolean;
  isDeleting: boolean;
  commentDraft: string;
  onToggleLike: () => void;
  onDelete: () => void;
  onCommentDraftChange: (value: string) => void;
  onSubmitComment: (event: FormEvent) => void;
};

function PostTime({ value }: { value: string }) {
  return <time className="cm-time" dateTime={value} title={communityExactTime(value)}>{communityRelativeTime(value)}</time>;
}

/** Menu "Tùy chọn bài viết" (chỉ bài của mình): hiện có "Xóa bài"; "Lưu bài" làm ở GĐ5. */
function PostMenu({ onDelete, deleting }: { onDelete: () => void; deleting: boolean }) {
  const { open, rootRef, panelId, buttonProps, close } = useDisclosure();
  return (
    <div className="cm-menu" ref={rootRef}>
      <button type="button" className="ui-icon-button ui-icon-button--quiet" aria-label="Tùy chọn bài viết" {...buttonProps}>
        <MoreHorizontal aria-hidden="true" />
      </button>
      <div id={panelId} className="cm-menu__panel" hidden={!open}>
        <button type="button" className="cm-menu__item cm-menu__item--danger" disabled={deleting} onClick={() => { close(); onDelete(); }}>
          <Trash2 aria-hidden="true" /><span>Xóa bài</span>
        </button>
      </div>
    </div>
  );
}

export default function PostCard(props: PostCardProps) {
  const { post, userName, isOwn, isFocused, isLikePending, isCommentPending, commentDraft } = props;
  const focusCommentInput = () => document.getElementById(communityCommentInputId(post.id))?.focus();

  return (
    <Card
      as="article"
      id={communityPostElementId(post.id)}
      className={cx("cm-post", isFocused && "cm-post--focus")}
      aria-label={`Bài viết của ${post.author.name}`}
    >
      <header className="cm-post__head">
        <span className="cm-avatar" aria-hidden="true">{communityInitials(post.author.name)}</span>
        <div className="cm-post__who">
          <span className="cm-post__author">
            {post.author.name}
            {post.author.isSample && <Tag className="cm-sample-tag">Tài khoản mẫu</Tag>}
          </span>
          <PostTime value={post.createdAt} />
        </div>
        {isOwn && <PostMenu onDelete={props.onDelete} deleting={props.isDeleting} />}
      </header>

      {post.content && <p className="cm-post__content">{post.content}</p>}
      <PostImages images={post.images ?? []} authorName={post.author.name} />
      {post.recipe && <RecipeAttachmentCard recipe={post.recipe} />}

      <p className="cm-post__stats">
        <span>{post.likeCount} lượt thích</span>
        <span>{post.commentCount} bình luận</span>
      </p>
      <div className="cm-post__actions">
        <button type="button" className="cm-action" aria-pressed={post.likedByMe} disabled={isLikePending} onClick={props.onToggleLike}>
          <Heart aria-hidden="true" /><span>{post.likedByMe ? "Đã thích" : "Thích"}</span>
        </button>
        <button type="button" className="cm-action" onClick={focusCommentInput}>
          <MessageCircle aria-hidden="true" /><span>Bình luận</span>
        </button>
        <button type="button" className="cm-action" onClick={() => void shareCommunityPost(post)}>
          <Share2 aria-hidden="true" /><span>Chia sẻ</span>
        </button>
      </div>

      {post.comments.length > 0 && (
        <ul className="cm-comments" aria-label="Bình luận">
          {post.comments.map((comment) => (
            <li className="cm-comment" key={comment.id}>
              <span className="cm-avatar cm-avatar--small" aria-hidden="true">{communityInitials(comment.author.name)}</span>
              <div className="cm-comment__body">
                <p className="cm-comment__head"><span className="cm-comment__author">{comment.author.name}</span><PostTime value={comment.createdAt} /></p>
                <p className="cm-comment__text">{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CommentForm
        postId={post.id}
        postAuthorName={post.author.name}
        userName={userName}
        value={commentDraft}
        onChange={props.onCommentDraftChange}
        onSubmit={props.onSubmitComment}
        isPending={isCommentPending}
      />
    </Card>
  );
}
