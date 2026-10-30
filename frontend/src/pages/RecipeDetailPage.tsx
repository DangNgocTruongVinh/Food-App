import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import RecipeDetailHero from "../components/recipes/RecipeDetailHero";
import { RecipeDetailError } from "../components/recipes/RecipeDetailStates";
import RecipeForYouCard, { RecipeForYouAlerts } from "../components/recipes/RecipeForYouCard";
import RecipeIngredientsCard from "../components/recipes/RecipeIngredientsCard";
import RecipeNutritionStrip from "../components/recipes/RecipeNutritionStrip";
import RecipeStepsCard from "../components/recipes/RecipeStepsCard";
import { LoadingState } from "../components/States";
import { clampServings } from "../features/recipes/recipes.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";

export default function RecipeDetailPage() {
  const { id = "" } = useParams();
  const { data: recipe, isLoading, isError, error, refetch } = useQuery(recipeQueries.detail(id));
  // Tải song song với chi tiết; món đã ngừng sử dụng thì backend trả 404 (không thử lại) và khối này không hiển thị.
  const forYou = useQuery(recipeQueries.forYou(id));
  // Số khẩu phần gắn với id công thức: sang món khác thì tự về số khẩu phần của món đó.
  const [servingChoice, setServingChoice] = useState<{ recipeId: string; servings: number } | null>(null);

  if (isLoading) return <LoadingState />;
  if (isError || !recipe) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const notFound = status !== undefined && status >= 400 && status < 500;
    return <div className="page recipe-detail-page"><RecipeDetailError notFound={notFound} onRetry={() => void refetch()} /></div>;
  }

  const servings = servingChoice?.recipeId === recipe.id ? servingChoice.servings : recipe.servings;
  const changeServings = (next: number) => setServingChoice({ recipeId: recipe.id, servings: clampServings(next, recipe.servings) });

  return <div className="page recipe-detail-page">
    <nav className="recipe-detail-nav" aria-label="Điều hướng công thức"><Link to="/recipes"><ArrowLeft /> Công thức</Link></nav>
    <RecipeDetailHero recipe={recipe} />
    {!recipe.hidden && <RecipeForYouAlerts data={forYou.data} />}
    <RecipeNutritionStrip recipe={recipe} />

    <div className="recipe-detail-body">
      <RecipeIngredientsCard
        ingredients={recipe.ingredients} recipeServings={recipe.servings} servings={servings} onServingsChange={changeServings}
      />
      <div className="recipe-detail-side">
        <RecipeStepsCard instructions={recipe.instructions} />
        {!recipe.hidden && (
          <RecipeForYouCard data={forYou.data} isLoading={forYou.isLoading} isError={forYou.isError} onRetry={() => void forYou.refetch()} />
        )}
      </div>
    </div>
  </div>;
}
