import { Clock3, Flame, Search } from "lucide-react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { formatNumber, recommendedRecipePantryNote } from "../../features/dashboard/dashboard.logic";
import { recipeDetailPath, recipeDietLabel, recipeImageSrc, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { DashboardRecommendedRecipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { Button, ButtonLink, EmptyState, Tag } from "../ui";

type RecommendedRecipesProps = {
  recipes: DashboardRecommendedRecipe[];
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent) => void;
};

/** Gợi ý món hợp hồ sơ (dashboard API đã lọc theo chế độ ăn, dị ứng, món không thích): thẻ đầu lớn hơn. */
export function RecommendedRecipes({ recipes, search, onSearchChange, onSearchSubmit }: RecommendedRecipesProps) {
  return (
    <section className="dash-recs" aria-labelledby="dash-recs-title">
      <header className="dash-recs__header">
        <div className="dash-recs__intro">
          <h2 id="dash-recs-title" className="ui-section-title">Món hợp với bạn</h2>
          <p className="ui-text">Lọc theo hồ sơ ăn uống, ưu tiên món dùng nguyên liệu trong tủ bếp.</p>
        </div>
        <form className="dash-search" role="search" onSubmit={onSearchSubmit}>
          <label className="ui-visually-hidden" htmlFor="dash-search">Tìm công thức theo tên món hoặc nguyên liệu</label>
          <input id="dash-search" className="ui-input" type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tìm món hoặc nguyên liệu" />
          <Button type="submit" icon={<Search />}>Tìm</Button>
        </form>
      </header>

      {!recipes.length ? (
        <EmptyState message="Chưa có món nào hợp với hồ sơ của bạn." action={<ButtonLink to="/recipes">Xem tất cả công thức</ButtonLink>} />
      ) : (
        <ul className="dash-recs__grid">
          {recipes.map((recipe, index) => {
            const note = recommendedRecipePantryNote(recipe);
            const tags = recipe.dietTags.filter((tag) => tag !== "BALANCED").slice(0, 2);
            return (
              <li key={recipe.id} className={index === 0 ? "dash-rec dash-rec--featured" : "dash-rec"}>
                <article className="dash-rec__card">
                  <img className="dash-rec__image" src={recipeImageSrc(recipe, IMAGE_WIDTHS.card)} alt={`Ảnh món ${recipe.name}`} />
                  <div className="dash-rec__body">
                    <h3 className="dash-rec__title"><Link to={recipeDetailPath(recipe.id)}>{recipe.name}</Link></h3>
                    <ul className="dash-specs" aria-label="Thông tin món">
                      <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(recipe)} phút</li>
                      <li><Flame aria-hidden="true" />{formatNumber(recipe.calories)} kcal</li>
                    </ul>
                    {note && <p className="dash-rec__note">{note}</p>}
                    {tags.length > 0 && <div className="dash-rec__tags">{tags.map((tag) => <Tag key={tag}>{recipeDietLabel(tag)}</Tag>)}</div>}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {recipes.length > 0 && <Link className="ui-link dash-recs__all" to="/recipes">Xem tất cả công thức</Link>}
    </section>
  );
}
