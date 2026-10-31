import { recipePhotoSrc } from "../../features/recipes/recipes.logic";
import { cx } from "../../features/ui/ui.logic";
import type { Recipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";

type RecipeImageProps = {
  recipe: Pick<Recipe, "name" | "imageUrl">;
  /** Chiều rộng hiển thị tối đa (IMAGE_WIDTHS); ảnh nhỏ (thumb) chỉ hiện chữ cái đầu khi chưa có ảnh. */
  width?: number;
  /** Mô tả ảnh; "" khi ảnh chỉ để trang trí (tên món đã có ngay cạnh). Mặc định "Ảnh món …". */
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  draggable?: boolean;
};

/**
 * Ảnh món dùng chung mọi nơi: ảnh Cloudinary đã tải lên, hoặc ô --surface-2 kèm tên món khi chưa có ảnh thật
 * (DESIGN.md mục 10 — không dùng ảnh minh họa khác món).
 */
export function RecipeImage({ recipe, width = IMAGE_WIDTHS.card, alt, className, loading, draggable }: RecipeImageProps) {
  const src = recipePhotoSrc(recipe, width);
  const label = alt ?? `Ảnh món ${recipe.name}`;
  if (src) return <img className={cx("ui-recipe-image", className)} src={src} alt={label} loading={loading} draggable={draggable} />;

  const size = width <= IMAGE_WIDTHS.thumb ? "thumb" : width >= IMAGE_WIDTHS.hero ? "hero" : "card";
  return (
    <span
      className={cx("ui-recipe-image", "ui-recipe-image--empty", `ui-recipe-image--${size}`, className)}
      role={label ? "img" : undefined}
      aria-label={label ? `${recipe.name}, chưa có ảnh` : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className="ui-recipe-image__name" aria-hidden="true">{size === "thumb" ? recipe.name.trim().charAt(0) : recipe.name}</span>
    </span>
  );
}
