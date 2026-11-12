import { BookOpen, ImagePlus, NotebookPen } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { COMMUNITY_IMAGE_TYPES, COMMUNITY_MAX_IMAGES, COMMUNITY_POST_MAX_LENGTH, communityInitials } from "../../features/community/community.logic";
import { cx } from "../../features/ui/ui.logic";
import type { CommunityRecipeSummary } from "../../types";
import { Button, Card } from "../ui";
import ComposerImagePreviews from "./ComposerImagePreviews";
import RecipeAttachmentCard from "./RecipeAttachmentCard";

export const COMMUNITY_POST_INPUT_ID = "community-post";

type PostComposerProps = {
  userName?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  isPending: boolean;
  canPublish: boolean;
  attachedRecipe: CommunityRecipeSummary | null;
  onRemoveRecipe: () => void;
  isPickerOpen: boolean;
  onTogglePicker: () => void;
  /** Ô chọn công thức, hiện ngay dưới khung nhập khi đang mở. */
  picker?: ReactNode;
  /** Đang tự viết công thức (loại trừ với món có sẵn); form hiện ngay dưới khung nhập. */
  isWriting: boolean;
  onToggleWriting: () => void;
  memberFields?: ReactNode;
  images: File[];
  imageError: string | null;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
  /** Lỗi khi đăng (từ API), hiện ngay trong ô đăng bài. */
  error?: ReactNode;
};

/** Ô đăng bài: chữ (tối đa 2000 ký tự), tối đa 4 ảnh, chọn một trong hai: đính kèm món có sẵn hoặc tự viết công thức. */
export default function PostComposer(props: PostComposerProps) {
  const { userName, value, onChange, onSubmit, isPending, canPublish, attachedRecipe } = props;
  const imagesFull = props.images.length >= COMMUNITY_MAX_IMAGES;
  return (
    <Card as="section" className="cm-composer" aria-labelledby="cm-composer-title">
      <form onSubmit={onSubmit} className="cm-composer__form">
        <div className="cm-composer__head">
          <span className="cm-avatar" aria-hidden="true">{communityInitials(userName ?? "N")}</span>
          <label id="cm-composer-title" className="cm-composer__label" htmlFor={COMMUNITY_POST_INPUT_ID}>Chia sẻ với cộng đồng</label>
        </div>
        <textarea
          id={COMMUNITY_POST_INPUT_ID}
          className="ui-input cm-composer__input"
          rows={3}
          maxLength={COMMUNITY_POST_MAX_LENGTH}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Hôm nay bạn nấu món gì, có mẹo nào muốn chia sẻ?"
          aria-describedby="cm-composer-count"
        />
        {props.isPickerOpen && props.picker}
        {props.isWriting && props.memberFields}
        {attachedRecipe && <RecipeAttachmentCard recipe={attachedRecipe} onRemove={props.onRemoveRecipe} />}
        <ComposerImagePreviews images={props.images} onRemove={props.onRemoveImage} />
        {props.imageError && <p className="cm-composer__error" role="alert">{props.imageError}</p>}
        {props.error}
        <div className="cm-composer__footer">
          <div className="cm-composer__tools" role="group" aria-label="Thêm vào bài viết">
            <label className={cx("ui-button ui-button--secondary cm-tool", imagesFull && "is-disabled")} aria-disabled={imagesFull || undefined}>
              <ImagePlus aria-hidden="true" />
              <span>Ảnh</span>
              <span className="ui-visually-hidden">(tối đa {COMMUNITY_MAX_IMAGES} ảnh JPG, PNG, WEBP, mỗi ảnh tối đa 5 MB)</span>
              <input
                type="file"
                className="cm-tool__file"
                accept={COMMUNITY_IMAGE_TYPES.join(",")}
                multiple
                disabled={imagesFull}
                onChange={(event) => {
                  props.onAddImages(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </label>
            <Button className="cm-tool" icon={<BookOpen />} aria-expanded={props.isPickerOpen} onClick={props.onTogglePicker}>Đính kèm món có sẵn</Button>
            <Button className="cm-tool" icon={<NotebookPen />} aria-pressed={props.isWriting} onClick={props.onToggleWriting}>Tự viết công thức</Button>
          </div>
          <div className="cm-composer__publish">
            <span id="cm-composer-count" className="cm-composer__count">{value.length}/{COMMUNITY_POST_MAX_LENGTH}</span>
            <Button type="submit" variant="primary" disabled={!canPublish} busy={isPending}>{isPending ? "Đang đăng..." : "Đăng bài"}</Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
