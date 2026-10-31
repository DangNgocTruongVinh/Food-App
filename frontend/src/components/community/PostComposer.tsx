import { BookOpen, ImagePlus, Send } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { COMMUNITY_IMAGE_TYPES, COMMUNITY_MAX_IMAGES, COMMUNITY_POST_MAX_LENGTH, communityInitials } from "../../features/community/community.logic";
import type { CommunityRecipeSummary } from "../../types";
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
  images: File[];
  imageError: string | null;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
};

export default function PostComposer(props: PostComposerProps) {
  const { userName, value, onChange, onSubmit, isPending, canPublish, attachedRecipe } = props;
  return <form className="community-composer" onSubmit={onSubmit}>
    <span className="community-avatar">{communityInitials(userName ?? "N")}</span>
    <div className="community-composer-body">
      <label htmlFor={COMMUNITY_POST_INPUT_ID}>Chia sẻ với cộng đồng</label>
      <textarea
        id={COMMUNITY_POST_INPUT_ID}
        rows={3}
        maxLength={COMMUNITY_POST_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Hôm nay bạn đã nấu món gì, học được mẹo nào hay?"
      />
      {props.isPickerOpen && props.picker}
      {attachedRecipe && <RecipeAttachmentCard recipe={attachedRecipe} onRemove={props.onRemoveRecipe} />}
      <ComposerImagePreviews images={props.images} onRemove={props.onRemoveImage} />
      {props.imageError && <p className="community-image-error" role="alert">{props.imageError}</p>}
      <footer className="community-composer-footer">
        <div className="community-composer-tools" aria-label="Loại nội dung">
          <label className={`community-image-tool${props.images.length >= COMMUNITY_MAX_IMAGES ? " disabled" : ""}`} title="Thêm ảnh">
            <ImagePlus /> <span>Ảnh</span>
            <input
              type="file" accept={COMMUNITY_IMAGE_TYPES.join(",")} multiple hidden disabled={props.images.length >= COMMUNITY_MAX_IMAGES}
              onChange={(event) => {
                props.onAddImages(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button" className="community-recipe-tool" title="Chia sẻ công thức"
            aria-expanded={props.isPickerOpen} onClick={props.onTogglePicker}
          >
            <BookOpen /> <span>Công thức</span>
          </button>
        </div>
        <div className="community-publish-row">
          <small>{value.length}/{COMMUNITY_POST_MAX_LENGTH}</small>
          <button className="community-publish" disabled={!canPublish || isPending}>
            <Send /> {isPending ? "Đang đăng..." : "Đăng bài"}
          </button>
        </div>
      </footer>
    </div>
  </form>;
}
