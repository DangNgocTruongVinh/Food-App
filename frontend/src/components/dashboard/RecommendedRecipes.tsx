import { ArrowRight, Bookmark, Clock3, Flame, Leaf, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { recommendedRecipeImage, recommendedRecipePath } from "../../features/dashboard/dashboard.logic";
import type { DashboardData } from "../../types";

type RecommendedRecipesProps = { recipes: DashboardData["recommendedRecipes"]; areRealRecipes: boolean };

export default function RecommendedRecipes({ recipes, areRealRecipes }: RecommendedRecipesProps) {
  return <article className="overview-v2-panel overview-v2-suggestions">
    <header>
      <div><h2>Gợi ý riêng cho bạn <Sparkles /></h2><p>Dựa trên nguyên liệu trong kho và khẩu vị của bạn</p></div>
      <Link to="/recipes">Xem tất cả <ArrowRight /></Link>
    </header>
    <div className="overview-v2-recipe-grid">
      {recipes.map((recipe, index) => {
        const recipePath = recommendedRecipePath(recipe.id, areRealRecipes);
        return <article className="overview-v2-recipe-card" key={recipe.id}>
          <Link className="overview-v2-recipe-image" to={recipePath}><img src={recommendedRecipeImage(index, recipe.name)} alt={recipe.name} /></Link>
          <button type="button" aria-label={`Lưu ${recipe.name}`}><Bookmark /></button>
          <div>
            <Link to={recipePath}><h3>{recipe.name}</h3></Link>
            <small><Leaf /> Dùng nguyên liệu trong kho</small>
            <footer><span><Clock3 /> {recipe.prepMinutes + recipe.cookMinutes} phút</span><span><Flame /> {recipe.calories} kcal</span></footer>
          </div>
        </article>;
      })}
    </div>
    <div className="overview-v2-dots" aria-hidden="true"><i className="active" /><i /><i /></div>
  </article>;
}
