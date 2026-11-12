import { useState, type FormEvent } from "react";
import { COMMUNITY_POST_MAX_LENGTH } from "../../features/community/community.logic";
import {
  draftFromMemberRecipe, emptyMemberRecipeDraft, toMemberRecipe, type MemberRecipeDraft,
} from "../../features/community/member-recipe.logic";
import type { CommunityPost, MemberRecipe } from "../../types";
import { Button, Dialog } from "../ui";
import MemberRecipeFields from "./MemberRecipeFields";

type EditPostDialogProps = {
  post: CommunityPost;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (input: { content: string; memberRecipe: MemberRecipe | null }) => void;
};

/**
 * Sửa bài của tôi: nội dung và công thức tự viết. Bài đã đính kèm món có sẵn thì chỉ sửa nội dung. Ảnh và món đính kèm giữ nguyên.
 */
export default function EditPostDialog({ post, busy, error, onClose, onSave }: EditPostDialogProps) {
  const [content, setContent] = useState(post.content);
  const [draft, setDraft] = useState<MemberRecipeDraft | null>(post.memberRecipe ? draftFromMemberRecipe(post.memberRecipe) : null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const canHaveRecipe = !post.recipe;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return onSave({ content: content.trim(), memberRecipe: null });
    const result = toMemberRecipe(draft);
    if ("error" in result) return setDraftError(result.error);
    setDraftError(null);
    onSave({ content: content.trim(), memberRecipe: result.recipe });
  };

  return (
    <Dialog title="Sửa bài viết" description="Ảnh và món đính kèm giữ nguyên." onClose={onClose} className="cm-edit-dialog">
      <form className="cm-edit-form" onSubmit={submit}>
        <label className="cm-member-field">
          <span>Nội dung</span>
          <textarea className="ui-input" rows={3} maxLength={COMMUNITY_POST_MAX_LENGTH} value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
        {canHaveRecipe && (draft ? (
          <MemberRecipeFields idPrefix={`edit-${post.id}`} draft={draft} onChange={setDraft} onRemove={() => setDraft(null)} error={draftError} />
        ) : (
          <Button className="cm-edit-form__add" onClick={() => setDraft(emptyMemberRecipeDraft())}>Thêm công thức tự viết</Button>
        ))}
        {error && <p className="cm-composer__error" role="alert">{error}</p>}
        <div className="cm-edit-form__actions">
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" busy={busy}>{busy ? "Đang lưu..." : "Lưu thay đổi"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
