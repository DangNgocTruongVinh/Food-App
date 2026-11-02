import { ImagePlus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { recipeImageError } from "../../features/admin/admin-recipes.logic";
import { COMMUNITY_IMAGE_TYPES } from "../../features/community/community.logic";
import { IMAGE_WIDTHS } from "../../utils/images";
import { Button, ErrorState, RecipeImage } from "../ui";

type ImageFieldProps = {
  name: string;
  imageUrl: string | null;
  file: File | null;
  error: string;
  uploading: boolean;
  /** Món đã có (trang sửa): tải ảnh lên ngay; món mới: ảnh tải lên sau khi tạo món. */
  canUploadNow: boolean;
  onSelect: (file: File | null, error: string) => void;
  onUpload: () => void;
  onRemoveImage: () => void;
};

/** Ảnh món: chọn ảnh (kiểm tra định dạng/dung lượng trước khi gửi), xem trước, tải lên hoặc thay ảnh. */
export function AdminRecipeImageField({ name, imageUrl, file, error, uploading, canUploadNow, onSelect, onUpload, onRemoveImage }: ImageFieldProps) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <section className="ad-form__section" aria-labelledby="ad-form-image">
      <h3 id="ad-form-image" className="ad-form__title">Ảnh món</h3>
      <div className="ad-image">
        <div className="ad-image__frame">
          {preview
            ? <img className="ad-image__preview" src={preview} alt={`Ảnh xem trước: ${file?.name}`} />
            : <RecipeImage className="ad-image__preview" recipe={{ name: name || "Món mới", imageUrl }} width={IMAGE_WIDTHS.card} />}
        </div>
        <div className="ad-image__actions">
          <label className="ui-button ui-button--secondary ad-image__pick">
            <ImagePlus aria-hidden="true" />
            <span>{imageUrl || file ? "Chọn ảnh khác" : "Chọn ảnh"}</span>
            <input
              type="file"
              className="ad-image__file"
              accept={COMMUNITY_IMAGE_TYPES.join(",")}
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (!picked) return;
                const problem = recipeImageError(picked);
                onSelect(problem ? null : picked, problem ?? "");
              }}
            />
          </label>
          {file && canUploadNow && <Button variant="primary" busy={uploading} onClick={onUpload}>{uploading ? "Đang tải ảnh lên..." : "Tải ảnh lên"}</Button>}
          {file && <Button onClick={() => onSelect(null, "")} disabled={uploading}>Bỏ ảnh đã chọn</Button>}
          {!file && imageUrl && <Button onClick={onRemoveImage}>Bỏ ảnh hiện tại</Button>}
          <p className="ui-small">
            JPG, PNG hoặc WEBP, tối đa 5 MB.{" "}
            {file && !canUploadNow ? "Ảnh được tải lên ngay sau khi tạo món." : !file && imageUrl ? "Bỏ ảnh có hiệu lực khi bấm Lưu thay đổi." : ""}
          </p>
        </div>
      </div>
      {error && <ErrorState message={error} />}
    </section>
  );
}
