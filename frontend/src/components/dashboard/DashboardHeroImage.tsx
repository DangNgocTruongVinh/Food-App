import { useEffect, useState } from "react";
import { recipePhotoSrc } from "../../features/recipes/recipes.logic";
import type { DashboardRecommendedRecipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";

/** Ảnh dự phòng khi món chưa có ảnh thật (hoặc ảnh lỗi): ảnh bàn ăn chung của thương hiệu. */
export const DASHBOARD_FALLBACK_IMAGE = `${import.meta.env.BASE_URL}assets/home/hero-table-960.webp`;

type DashboardHeroImageProps = {
  /** Món đang là "Món của hôm nay" (null: chưa có món gợi ý). */
  recipe: DashboardRecommendedRecipe | null;
  /** Hai món kế tiếp trong danh sách: tải trước ảnh để "Đổi món khác" không chớp trắng. */
  upcoming: DashboardRecommendedRecipe[];
};

/**
 * Ảnh lớn ở đầu trang Tổng quan: ảnh thật (Recipe.imageUrl, Cloudinary) của đúng "Món của hôm nay"; chưa có hoặc tải lỗi thì
 * ảnh bàn ăn dự phòng. Đổi món: ảnh cũ ở lại (mờ đi) tới khi ảnh mới tải xong, rồi ảnh mới hiện dần lên trên (~250ms, CSS).
 * alt là tên món khi là ảnh của món; ảnh dự phòng không phải ảnh món nên alt rỗng (chỉ trang trí).
 */
export function DashboardHeroImage({ recipe, upcoming }: DashboardHeroImageProps) {
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const photo = recipe ? recipePhotoSrc(recipe, IMAGE_WIDTHS.hero) : null;
  const usable = photo && !broken.has(photo) ? photo : null;
  const src = usable ?? DASHBOARD_FALLBACK_IMAGE;
  const alt = usable && recipe ? recipe.name : "";

  // shown: ảnh đang hiện đầy đủ; ready: ảnh mới đã tải xong, đang hiện dần.
  const [shown, setShown] = useState(src);
  const [ready, setReady] = useState<string | null>(null);
  const changing = src !== shown;
  const markBroken = (url: string) => setBroken((set) => new Set(set).add(url));

  const upcomingKey = upcoming.map((item) => item.id).join(",");
  useEffect(() => {
    for (const item of upcoming) {
      const url = recipePhotoSrc(item, IMAGE_WIDTHS.hero);
      if (url) new Image().src = url;
    }
    // Chỉ chạy lại khi đổi món kế tiếp (mảng mới mỗi lần vẽ nhưng cùng nội dung).
  }, [upcomingKey]);

  return (
    <div className="dash-hero__media" aria-busy={changing && ready !== src}>
      <img
        className={changing && ready !== src ? "dash-hero__image is-stale" : "dash-hero__image"}
        src={shown}
        alt={changing ? "" : alt}
        aria-hidden={changing || undefined}
        fetchPriority="high"
        onError={() => shown !== DASHBOARD_FALLBACK_IMAGE && markBroken(shown)}
      />
      {changing && (
        <img
          key={src}
          className={ready === src ? "dash-hero__image dash-hero__image--top dash-hero__image--fade" : "dash-hero__image dash-hero__image--top"}
          src={src}
          alt={alt}
          onLoad={() => setReady(src)}
          onError={() => (src === DASHBOARD_FALLBACK_IMAGE ? setReady(src) : markBroken(src))}
          onAnimationEnd={() => setShown(src)}
        />
      )}
    </div>
  );
}
