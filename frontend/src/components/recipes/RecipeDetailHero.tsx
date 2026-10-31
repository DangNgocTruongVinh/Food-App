import { Clock3, CookingPot, Share2, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { communityShareRecipePath } from "../../features/community/community.logic";
import { recipeDietLabel, recipeImageSrc, recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { Recipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { RecipeBackLink } from "./RecipeDetailStates";

export default function RecipeDetailHero({ recipe }: { recipe: Recipe }) {
  return <header className="recipe-detail-hero">
    <img src={recipeImageSrc(recipe, IMAGE_WIDTHS.hero)} alt={recipe.name} />
    <div className="recipe-detail-intro">
      <div className="recipe-detail-tags"><b>{recipe.cuisine}</b>{recipe.dietTags.map((tag) => <b key={tag}>{recipeDietLabel(tag)}</b>)}</div>
      <h1>{recipe.name}</h1>
      <p>{recipe.description}</p>
      <ul className="recipe-detail-facts">
        <li>
          <Clock3 />
          <span><strong>{recipeTotalMinutes(recipe)} phút</strong><small>Sơ chế {recipe.prepMinutes} · Nấu {recipe.cookMinutes}</small></span>
        </li>
        <li><UsersRound /><span><strong>{recipe.servings} khẩu phần</strong><small>Theo công thức</small></span></li>
        <li>
          <CookingPot />
          <span><strong>{recipe.ingredients.length} nguyên liệu</strong><small>{recipe.instructions.length} bước thực hiện</small></span>
        </li>
      </ul>
      {recipe.hidden && <p className="recipe-detail-hidden-note" role="status">Món này đã ngừng sử dụng.</p>}
      {/* GĐ5: nút "Thêm vào thực đơn" đặt trong khối hành động này; món đã ngừng sử dụng thì ẩn cả hai nút. */}
      <div className="recipe-detail-actions">
        {!recipe.hidden && <Link className="button primary" to={communityShareRecipePath(recipe.id)}><Share2 /> Chia sẻ lên cộng đồng</Link>}
        <RecipeBackLink />
      </div>
    </div>
  </header>;
}
