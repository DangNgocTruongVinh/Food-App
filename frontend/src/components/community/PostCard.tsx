import { Bookmark, Heart, MessageCircle, MoreHorizontal, Share2, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import {
  communityCommentInputId, communityInitials, communityPostElementId, communityRelativeTime, shareCommunityPost,
} from "../../features/community/community.logic";
import type { CommunityPost } from "../../types";
import CommentForm from "./CommentForm";
import PostImages from "./PostImages";
import RecipeAttachmentCard from "./RecipeAttachmentCard";

type PostCardProps = {
  post: CommunityPost;
  userName?: string;
  isFocused: boolean;
  isSaved: boolean;
  isLikePending: boolean;
  isCommentPending: boolean;
  commentDraft: string;
  onToggleLike: () => void;
  onToggleSaved: () => void;
  onCommentDraftChange: (value: string) => void;
  onSubmitComment: (event: FormEvent) => void;
};

export default function PostCard(props: PostCardProps) {
  const { post, userName, isFocused, isSaved, isLikePending, isCommentPending, commentDraft } = props;
  const focusCommentInput = () => document.getElementById(communityCommentInputId(post.id))?.focus();

  return <article id={communityPostElementId(post.id)} className={`community-post${isFocused ? " notification-target" : ""}`}>
    <header className="community-post-header">
      <span className="community-avatar">{communityInitials(post.author.name)}</span>
      <div className="community-post-author">
        <strong>{post.author.name}</strong>
        <div className="community-post-meta">
          <time dateTime={post.createdAt}>{communityRelativeTime(post.createdAt)}</time>
          <span className="community-member-badge"><Sparkles /> Thành viên tích cực</span>
        </div>
      </div>
      <button className="community-post-menu" type="button" aria-label="Tùy chọn bài viết"><MoreHorizontal /></button>
    </header>

    {post.content && <p className="community-post-content">{post.content}</p>}
    <PostImages images={post.images ?? []} authorName={post.author.name} />
    {post.recipe && <RecipeAttachmentCard recipe={post.recipe} />}

    <div className="community-post-stats">
      <span><Heart /> {post.likeCount} lượt thích</span>
      <span>{post.commentCount} bình luận</span>
    </div>
    <div className="community-post-actions">
      <button
        type="button" className={post.likedByMe ? "liked" : ""} aria-pressed={post.likedByMe} disabled={isLikePending} onClick={props.onToggleLike}
      >
        <Heart /> {post.likedByMe ? "Đã thích" : "Thích"}
      </button>
      <button type="button" onClick={focusCommentInput}><MessageCircle /> Bình luận</button>
      <button type="button" onClick={() => void shareCommunityPost(post)}><Share2 /> Chia sẻ</button>
      <button type="button" className={isSaved ? "saved" : ""} aria-pressed={isSaved} onClick={props.onToggleSaved}>
        <Bookmark /> {isSaved ? "Đã lưu" : "Lưu"}
      </button>
    </div>

    {post.comments.length > 0 && (
      <div className="community-comments">
        {post.comments.map((comment) => (
          <div className="community-comment" key={comment.id}>
            <span className="community-avatar small">{communityInitials(comment.author.name)}</span>
            <div>
              <header>
                <strong>{comment.author.name}</strong><time dateTime={comment.createdAt}>{communityRelativeTime(comment.createdAt)}</time>
              </header>
              <p>{comment.content}</p>
            </div>
          </div>
        ))}
      </div>
    )}

    <CommentForm
      postId={post.id} postAuthorName={post.author.name} userName={userName} value={commentDraft}
      onChange={props.onCommentDraftChange} onSubmit={props.onSubmitComment} isPending={isCommentPending}
    />
  </article>;
}
