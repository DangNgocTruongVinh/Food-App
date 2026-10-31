import { Beef, Clock3, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { recipeDetailPath, recipeDietLabel, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { Recipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { RecipeImage, Tag } from "../ui";

/** Thẻ món trong "Tất cả công thức": ảnh 4:3, tên (link), thông số là nhãn riêng có icon, nhãn ẩm thực/chế độ ăn. */
export function RecipeCard({ recipe, layout }: { recipe: Recipe; layout: "grid" | "list" }) {
  const diet = recipe.dietTags.find((tag) => tag !== "BALANCED");
  return (
    <article className={`recipe-tile recipe-tile--${layout}`}>
      <RecipeImage className="recipe-tile__image" recipe={recipe} width={IMAGE_WIDTHS.card} alt="" loading="lazy" />
      <div className="recipe-tile__body">
        <h3 className="recipe-tile__title"><Link to={recipeDetailPath(recipe.id)}>{recipe.name}</Link></h3>
        {layout === "list" && <p className="ui-small recipe-tile__desc">{recipe.description}</p>}
        <ul className="recipe-specs" aria-label="Thông tin món">
          <li><Clock3 aria-hidden="true" />{recipeTotalMinutes(recipe)} phút</li>
          <li><Flame aria-hidden="true" />{formatNumber(recipe.calories)} kcal</li>
          <li><Beef aria-hidden="true" />{formatNumber(recipe.proteinG)} g đạm</li>
        </ul>
        <div className="recipe-tile__tags">
          <Tag>{recipe.cuisine}</Tag>
          {diet && <Tag>{recipeDietLabel(diet)}</Tag>}
        </div>
      </div>
    </article>
  );
}
