import { Clock3, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNumber, recommendedRecipePantryNote } from "../../features/dashboard/dashboard.logic";
import { recipeDetailPath, recipeDietLabel, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { DashboardRecommendedRecipe, Recipe, RecipeForYou } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { ButtonLink, RecipeImage, Tag } from "../ui";

type RecipesForYouProps = {
  /** Gợi ý theo hồ sơ (cùng logic với Tổng quan, dashboard API). */
  recommendations: DashboardRecommendedRecipe[];
  /** Món đầy đủ (ẩm thực, mô tả) tra theo id từ danh sách công thức. */
  recipesById: Map<string, Recipe>;
  /** Đối chiếu kho/hồ sơ của món lớn (GET /recipes/:id/for-you); chưa có thì ẩn phần kho. */
  featuredFit?: RecipeForYou;
};

/** "Dành cho bạn": 1 thẻ lớn + các thẻ nhỏ. Không có gợi ý thì không hiện mục này. */
export function RecipesForYou({ recommendations, recipesById, featuredFit }: RecipesForYouProps) {
  if (!recommendations.length) return null;
  const [featured, ...others] = recommendations;
  const full = recipesById.get(featured.id);
  const diet = featured.dietTags.find((tag) => tag !== "BALANCED");

  return (
    <section className="recipes-section" aria-labelledby="recipes-for-you-title">
      <header className="recipes-section__header">
        <h2 id="recipes-for-you-title" className="ui-section-title">Dành cho bạn</h2>
        <p className="ui-text">Hợp với dị ứng, món không thích và chế độ ăn trong hồ sơ; ưu tiên món dùng nguyên liệu trong tủ bếp.</p>
      </header>
      <div className="recipes-for-you">
        <article className="recipes-feature">
          <RecipeImage className="recipes-feature__image" recipe={featured} width={IMAGE_WIDTHS.card} />
          <div className="recipes-feature__body">
            <div className="recipe-tile__tags">
              {full && <Tag>{full.cuisine}</Tag>}
              {diet && <Tag>{recipeDietLabel(diet)}</Tag>}
            </div>
            <h3 className="recipes-feature__title">{featured.name}</h3>
            <ul className="recipe-specs" aria-label="Thông tin món">
              <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(featured)} phút</li>
              <li><Flame aria-hidden="true" />{formatNumber(featured.calories)} kcal</li>
              {featuredFit && <li>{featuredFit.calories.percentOfDailyTarget}% mục tiêu calo ngày</li>}
            </ul>
            {featuredFit ? (
              <dl className="recipes-feature__pantry">
                <dt>Có trong kho</dt>
                <dd>{featuredFit.pantry.inPantry.length ? featuredFit.pantry.inPantry.join(", ") : "Chưa có nguyên liệu nào"}</dd>
                <dt>Còn thiếu</dt>
                <dd>{featuredFit.pantry.missing.length ? featuredFit.pantry.missing.map((item) => item.name).join(", ") : "Không thiếu gì"}</dd>
              </dl>
            ) : full && <p className="ui-text">{full.description}</p>}
            <ButtonLink variant="primary" to={recipeDetailPath(featured.id)}>Xem công thức</ButtonLink>
          </div>
        </article>
        {others.length > 0 && (
          <ul className="recipes-for-you__side">
            {others.map((recipe) => {
              const note = recommendedRecipePantryNote(recipe);
              return (
                <li key={recipe.id} className="recipes-side">
                  <RecipeImage className="recipes-side__image" recipe={recipe} width={IMAGE_WIDTHS.thumb} alt="" />
                  <div className="recipes-side__body">
                    <Link className="recipes-side__title" to={recipeDetailPath(recipe.id)}>{recipe.name}</Link>
                    <ul className="recipe-specs" aria-label="Thông tin món">
                      <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(recipe)} phút</li>
                      <li><Flame aria-hidden="true" />{formatNumber(recipe.calories)} kcal</li>
                    </ul>
                    {note && <p className="recipes-side__note">{note}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
