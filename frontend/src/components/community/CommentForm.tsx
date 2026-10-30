import { Send } from "lucide-react";
import type { FormEvent } from "react";
import { COMMUNITY_COMMENT_MAX_LENGTH, communityCommentInputId, communityInitials } from "../../features/community/community.logic";

type CommentFormProps = {
  postId: string;
  postAuthorName: string;
  userName?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  isPending: boolean;
};

export default function CommentForm({ postId, postAuthorName, userName, value, onChange, onSubmit, isPending }: CommentFormProps) {
  return <form className="community-comment-form" onSubmit={onSubmit}>
    <span className="community-avatar small">{communityInitials(userName ?? "N")}</span>
    <div>
      <input
        id={communityCommentInputId(postId)}
        maxLength={COMMUNITY_COMMENT_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Viết bình luận..."
        aria-label={`Bình luận bài viết của ${postAuthorName}`}
      />
      <button aria-label="Gửi bình luận" disabled={!value.trim() || isPending}><Send /></button>
    </div>
  </form>;
}
