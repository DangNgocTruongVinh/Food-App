import { Clock3, Flame, Lightbulb } from "lucide-react";
import { recipeDetailPath, recipeDietLabel, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { Recipe, RecipeForYou, RecommendationItem } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { RecommendationList } from "../recommendations/RecommendationList";
import { ButtonLink, EmptyState, ErrorState, LoadingState, RecipeImage, Skeleton, Tag } from "../ui";

type RecipesForYouProps = {
  /** Bộ gợi ý, ngữ cảnh for-you (GET /api/recommendations). */
  recommendations: RecommendationItem[];
  /** Món đầy đủ (mô tả) tra theo id từ danh sách công thức. */
  recipesById: Map<string, Recipe>;
  /** Đối chiếu kho/hồ sơ của món lớn (GET /recipes/:id/for-you); chưa có thì ẩn phần kho. */
  featuredFit?: RecipeForYou;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
};

const Header = () => (
  <header className="recipes-section__header">
    <h2 id="recipes-for-you-title" className="ui-section-title">Dành cho bạn</h2>
    <p className="ui-text">Theo khẩu vị, những món bạn hay ăn và hồ sơ (dị ứng, món không thích, chế độ ăn); mỗi món ghi rõ vì sao được gợi ý.</p>
  </header>
);

/** "Dành cho bạn": 1 thẻ lớn (kèm đối chiếu kho) + các thẻ nhỏ dùng chung thẻ gợi ý. Đủ trạng thái đang tải, lỗi, trống. */
export function RecipesForYou({ recommendations, recipesById, featuredFit, isLoading, isError, isFetching, onRetry }: RecipesForYouProps) {
  if (isLoading || isError || !recommendations.length) {
    return (
      <section className="recipes-section" aria-labelledby="recipes-for-you-title">
        <Header />
        {isLoading ? (
          <LoadingState label="Đang tải gợi ý dành cho bạn"><Skeleton kind="block" height={240} /></LoadingState>
        ) : isError ? (
          <ErrorState message="Chưa tải được gợi ý dành cho bạn." onRetry={onRetry} retrying={isFetching} />
        ) : (
          <EmptyState message="Chưa có món nào hợp với hồ sơ của bạn." />
        )}
      </section>
    );
  }
  const [{ recipe: featured, reason }, ...others] = recommendations;
  const full = recipesById.get(featured.id);
  const diet = featured.dietTags.find((tag) => tag !== "BALANCED");

  return (
    <section className="recipes-section" aria-labelledby="recipes-for-you-title">
      <Header />
      <div className="recipes-for-you">
        <article className="recipes-feature">
          <RecipeImage className="recipes-feature__image" recipe={featured} width={IMAGE_WIDTHS.card} />
          <div className="recipes-feature__body">
            <div className="recipe-tile__tags">
              <Tag>{featured.cuisine}</Tag>
              {diet && <Tag>{recipeDietLabel(diet)}</Tag>}
            </div>
            <h3 className="recipes-feature__title">{featured.name}</h3>
            <ul className="recipe-specs" aria-label="Thông tin món">
              <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(featured)} phút</li>
              <li><Flame aria-hidden="true" />{featured.calories.toLocaleString("vi-VN")} kcal</li>
              {featuredFit && <li>{featuredFit.calories.percentOfDailyTarget}% mục tiêu calo ngày</li>}
            </ul>
            <p className="rc-card__reason"><Lightbulb aria-hidden="true" /><span>{reason}</span></p>
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
          <div className="recipes-for-you__side">
            <RecommendationList
              entries={others}
              variant="row"
              loadingLabel="Đang tải gợi ý"
              errorMessage="Chưa tải được gợi ý."
              emptyMessage={null}
            />
          </div>
        )}
      </div>
    </section>
  );
}
