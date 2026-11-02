import { X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { IconButton } from "../ui";

type ComposerImagePreviewsProps = { images: File[]; onRemove: (index: number) => void };

/** Xem trước ảnh đã chọn trong form đăng bài; mỗi ảnh có nút bỏ. URL tạm được thu hồi khi đổi danh sách. */
export default function ComposerImagePreviews({ images, onRemove }: ComposerImagePreviewsProps) {
  const previews = useMemo(() => images.map((file) => ({ file, url: URL.createObjectURL(file) })), [images]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  if (!previews.length) return null;
  return (
    <ul className="cm-previews" aria-label="Ảnh sẽ đăng">
      {previews.map(({ file, url }, index) => (
        <li key={url} className="cm-previews__item">
          <img src={url} alt={`Ảnh ${index + 1}: ${file.name}`} />
          <IconButton className="cm-previews__remove" label={`Bỏ ảnh ${file.name}`} icon={<X />} onClick={() => onRemove(index)} />
        </li>
      ))}
    </ul>
  );
}
