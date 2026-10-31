import type { CommunityPost } from "../../types";
import { IMAGE_WIDTHS, optimizedImageUrl } from "../../utils/images";

/** Ảnh trong bài viết (1–4 ảnh), tải bản Cloudinary đã tối ưu theo khổ thẻ. */
export default function PostImages({ images, authorName }: { images: CommunityPost["images"]; authorName: string }) {
  if (!images.length) return null;
  return <div className={`community-post-images count-${Math.min(images.length, 4)}`}>
    {images.map((image) => (
      <img key={image.url} src={optimizedImageUrl(image.url, IMAGE_WIDTHS.card)} alt={`Ảnh ${image.position + 1} của ${authorName}`} loading="lazy" />
    ))}
  </div>;
}
