import { CalendarPlus, Clock3, Flame, Shuffle, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { formatNumber, recommendationReason } from "../../features/dashboard/dashboard.logic";
import { recipeDetailPath, recipeImageSrc, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { DashboardRecommendedRecipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { Button, ButtonLink } from "../ui";

type DashboardHeroProps = {
  greeting: string;
  userName?: string;
  recipes: DashboardRecommendedRecipe[];
  hasProfile: boolean;
};

/** Đầu trang Tổng quan: lời chào theo giờ, "Hôm nay nấu gì?", món gợi ý kèm lý do từ dữ liệu thật. */
export function DashboardHero({ greeting, userName, recipes, hasProfile }: DashboardHeroProps) {
  const [index, setIndex] = useState(0);
  const recipe = recipes.length ? recipes[index % recipes.length] : null;
  const reason = recipe ? recommendationReason(recipe, hasProfile) : null;

  return (
    <section className={recipe ? "dash-hero dash-hero--image" : "dash-hero"} aria-labelledby="dash-hero-title">
      {recipe && <img className="dash-hero__image" src={recipeImageSrc(recipe, IMAGE_WIDTHS.hero)} alt={`Ảnh món ${recipe.name}`} />}
      <div className="dash-hero__inner">
        <div className="dash-hero__copy">
          <p className="dash-hero__greeting">{userName ? `${greeting}, ${userName}` : greeting}</p>
          <h1 id="dash-hero-title" className="ui-hero-title">Hôm nay<br /><em>nấu gì?</em></h1>
          {recipe ? (
            <>
              <div className="dash-hero__dish" aria-live="polite">
                <p className="ui-text">Gợi ý cho bạn: <strong>{recipe.name}</strong>.{reason ? ` ${reason}` : ""}</p>
                <ul className="dash-specs" aria-label="Thông tin món">
                  <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(recipe)} phút</li>
                  <li><Flame aria-hidden="true" />{formatNumber(recipe.calories)} kcal</li>
                </ul>
              </div>
              <div className="dash-hero__actions">
                <ButtonLink variant="primary" to={recipeDetailPath(recipe.id)} icon={<UtensilsCrossed />}>Xem công thức</ButtonLink>
                {recipes.length > 1 && <Button icon={<Shuffle />} onClick={() => setIndex((value) => value + 1)}>Đổi món khác</Button>}
              </div>
            </>
          ) : (
            <>
              <p className="ui-text">Chưa có món gợi ý cho bạn. Tạo thực đơn tuần để Nouri xếp bữa theo hồ sơ và tủ bếp của bạn.</p>
              <div className="dash-hero__actions">
                <ButtonLink variant="primary" to="/meal-plans" icon={<CalendarPlus />}>Tạo thực đơn</ButtonLink>
                <ButtonLink to="/recipes">Xem công thức</ButtonLink>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
