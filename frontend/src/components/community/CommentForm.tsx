import { Send } from "lucide-react";
import type { FormEvent } from "react";
import { COMMUNITY_COMMENT_MAX_LENGTH, communityCommentInputId, communityInitials } from "../../features/community/community.logic";
import { IconButton } from "../ui";

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
  return (
    <form className="cm-comment-form" onSubmit={onSubmit}>
      <span className="cm-avatar cm-avatar--small" aria-hidden="true">{communityInitials(userName ?? "N")}</span>
      <input
        id={communityCommentInputId(postId)}
        className="ui-input cm-comment-form__input"
        maxLength={COMMUNITY_COMMENT_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Viết bình luận"
        aria-label={`Bình luận bài viết của ${postAuthorName}`}
      />
      <IconButton type="submit" label="Gửi bình luận" icon={<Send />} disabled={!value.trim() || isPending} />
    </form>
  );
}
