import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useRecipeFavorite } from "../../features/recipes/useRecipeFavorite";
import { cx } from "../../features/ui/ui.logic";

type FavoriteButtonProps = {
  recipe: { id: string; name: string; favorite?: boolean; hidden?: boolean };
  /** "icon": nút tròn trên ảnh thẻ món; "labeled": nút có chữ ở trang chi tiết. */
  variant?: "icon" | "labeled";
};

/**
 * Trái tim yêu thích (UC24): đổi ngay khi bấm, gửi lên máy chủ, lỗi thì trả lại trạng thái cũ. Món đã ngừng sử dụng chỉ còn nút bỏ
 * yêu thích (không thêm mới được).
 */
export function FavoriteButton({ recipe, variant = "icon" }: FavoriteButtonProps) {
  const [on, setOn] = useState(Boolean(recipe.favorite));
  useEffect(() => setOn(Boolean(recipe.favorite)), [recipe.favorite]);
  const toggle = useRecipeFavorite();
  if (recipe.hidden && !on) return null;
  const label = on ? `Bỏ yêu thích ${recipe.name}` : `Yêu thích ${recipe.name}`;
  const click = () => {
    const next = !on;
    setOn(next);
    toggle.mutate({ id: recipe.id, favorite: next }, { onError: () => setOn(!next) });
  };
  return (
    <button
      type="button"
      className={cx("recipe-fav", `recipe-fav--${variant}`, on && "is-on")}
      aria-pressed={on}
      aria-label={variant === "icon" ? label : undefined}
      title={toggle.isError ? "Chưa lưu được, thử lại." : label}
      disabled={toggle.isPending}
      onClick={click}
    >
      <Heart aria-hidden="true" />
      {variant === "labeled" && <span>{on ? "Đã yêu thích" : "Yêu thích"}</span>}
    </button>
  );
}
