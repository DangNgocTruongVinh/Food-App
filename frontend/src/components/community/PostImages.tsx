import type { CommunityPost } from "../../types";
import { IMAGE_WIDTHS, optimizedImageUrl } from "../../utils/images";

/** Ảnh trong bài viết: 1 ảnh hiện to, 2–4 ảnh dạng lưới; tải bản Cloudinary đã tối ưu (optimizedImageUrl). */
export default function PostImages({ images, authorName }: { images: CommunityPost["images"]; authorName: string }) {
  if (!images.length) return null;
  const single = images.length === 1;
  return (
    <div className={`cm-images cm-images--${Math.min(images.length, 4)}`}>
      {images.map((image) => (
        <img
          key={image.url}
          className="cm-images__item"
          src={optimizedImageUrl(image.url, single ? IMAGE_WIDTHS.hero : IMAGE_WIDTHS.card)}
          alt={`Ảnh ${image.position + 1} trong bài của ${authorName}`}
          loading="lazy"
        />
      ))}
    </div>
  );
}
