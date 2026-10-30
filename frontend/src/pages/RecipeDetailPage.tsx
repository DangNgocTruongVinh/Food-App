import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import RecipeDetailHero from "../components/recipes/RecipeDetailHero";
import { RecipeDetailError } from "../components/recipes/RecipeDetailStates";
import RecipeForYouCard from "../components/recipes/RecipeForYouCard";
import RecipeIngredientsCard from "../components/recipes/RecipeIngredientsCard";
import RecipeNutritionStrip from "../components/recipes/RecipeNutritionStrip";
import RecipeStepsCard from "../components/recipes/RecipeStepsCard";
import { LoadingState } from "../components/States";
import { recipeQueries } from "../features/recipes/recipes.queries";

export default function RecipeDetailPage() {
  const { id = "" } = useParams();
  const { data: recipe, isLoading, isError, error, refetch } = useQuery(recipeQueries.detail(id));
  const forYou = useQuery(recipeQueries.forYou(id));

  if (isLoading) return <LoadingState />;
  if (isError || !recipe) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const notFound = status !== undefined && status >= 400 && status < 500;
    return <div className="page recipe-detail-page"><RecipeDetailError notFound={notFound} onRetry={() => void refetch()} /></div>;
  }

  return <div className="page recipe-detail-page">
    <nav className="recipe-detail-nav" aria-label="Điều hướng công thức"><Link to="/recipes"><ArrowLeft /> Công thức</Link></nav>
    <RecipeDetailHero recipe={recipe} />
    <RecipeNutritionStrip recipe={recipe} />

    <div className="recipe-detail-body">
      <RecipeIngredientsCard ingredients={recipe.ingredients} />
      <div className="recipe-detail-side">
        <RecipeStepsCard instructions={recipe.instructions} />
        <RecipeForYouCard data={forYou.data} isLoading={forYou.isLoading} isError={forYou.isError} onRetry={() => void forYou.refetch()} />
      </div>
    </div>
  </div>;
}
