import { CircleSlash, Clock3, Flame, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { recipeDietLabel, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { Recipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { RecipeImage, Tag } from "../ui";
import { FavoriteButton } from "./FavoriteButton";

type RecipeDetailHeroProps = {
  recipe: Recipe;
  /** Cảnh báo theo hồ sơ, đặt ngay dưới phần tên (trên điện thoại thấy được không cần cuộn). */
  alerts?: ReactNode;
};

/** Đầu trang chi tiết: tên (H1), mô tả, nhãn, thông số dạng nhãn có tên (không nối "·"), ảnh lớn. */
export function RecipeDetailHero({ recipe, alerts }: RecipeDetailHeroProps) {
  return (
    <header className="recipe-hero">
      <div className="recipe-hero__text">
        <div className="recipe-tile__tags">
          <Tag>{recipe.cuisine}</Tag>
          {recipe.dietTags.map((tag) => <Tag key={tag}>{recipeDietLabel(tag)}</Tag>)}
        </div>
        <h1 className="ui-title">{recipe.name}</h1>
        <div><FavoriteButton recipe={recipe} variant="labeled" /></div>
        <p className="ui-text">{recipe.description}</p>
        {recipe.hidden && (
          <p className="recipe-hidden-note" role="status">
            <CircleSlash aria-hidden="true" />
            <span><strong>Món này đã ngừng sử dụng.</strong> Bạn vẫn xem được cách nấu, nhưng không chia sẻ hay chọn món này cho thực đơn mới.</span>
          </p>
        )}
        {alerts}
        <dl className="recipe-facts">
          <div className="recipe-facts__item">
            <dt><Clock3 aria-hidden="true" />Thời gian</dt>
            <dd>{recipeTotalMinutes(recipe)} phút</dd>
            <dd className="recipe-facts__sub">Sơ chế {recipe.prepMinutes} phút, nấu {recipe.cookMinutes} phút</dd>
          </div>
          <div className="recipe-facts__item">
            <dt><UsersRound aria-hidden="true" />Khẩu phần</dt>
            <dd>{recipe.servings}</dd>
            <dd className="recipe-facts__sub">Theo công thức</dd>
          </div>
          <div className="recipe-facts__item">
            <dt><Flame aria-hidden="true" />Calo</dt>
            <dd>{formatNumber(recipe.calories)} kcal</dd>
            <dd className="recipe-facts__sub">Mỗi khẩu phần</dd>
          </div>
        </dl>
      </div>
      <RecipeImage className="recipe-hero__image" recipe={recipe} width={IMAGE_WIDTHS.hero} />
    </header>
  );
}
