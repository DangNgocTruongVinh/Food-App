import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useCallback, useState } from "react";
import { getApiError } from "../api/client";
import { AddToPlanDialog } from "../components/meal-plans/AddToPlanDialog";
import { useParams } from "react-router-dom";
import { RecipeDetailHero } from "../components/recipes/RecipeDetailHero";
import { RecipeBackLink, RecipeDetailError, RecipeDetailSkeleton } from "../components/recipes/RecipeDetailStates";
import RecipeForYouCard, { RecipeForYouAlerts } from "../components/recipes/RecipeForYouCard";
import RecipeIngredientsCard from "../components/recipes/RecipeIngredientsCard";
import RecipeNutritionStrip from "../components/recipes/RecipeNutritionStrip";
import RecipeStepsCard from "../components/recipes/RecipeStepsCard";
import { RecipeSuggestions } from "../components/recipes/RecipeSuggestions";
import { Toast } from "../components/ui";
import { communityShareRecipePath } from "../features/community/community.logic";
import { invalidateMealPlanQueries, mealPlanMutations } from "../features/meal-plans/meal-plans.queries";
import { clampServings } from "../features/recipes/recipes.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";

export default function RecipeDetailPage() {
  const { id = "" } = useParams();
  const { data: recipe, isLoading, isError, error, refetch, isFetching } = useQuery(recipeQueries.detail(id));
  // Tải song song với chi tiết; món đã ngừng sử dụng thì backend trả 404 (không thử lại) và khối này không hiển thị.
  const forYou = useQuery(recipeQueries.forYou(id));
  // Số khẩu phần gắn với id công thức: sang món khác thì tự về số khẩu phần của món đó.
  const [servingChoice, setServingChoice] = useState<{ recipeId: string; servings: number } | null>(null);
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const addToPlan = useMutation({
    ...mealPlanMutations.addItem(),
    onSuccess: (plan) => {
      invalidateMealPlanQueries(queryClient, true);
      setAddOpen(false);
      setToast(`Đã thêm món vào “${plan.name}”.`);
    },
    onError: (err) => setAddError(getApiError(err)),
  });

  if (isLoading) return <RecipeDetailSkeleton />;
  if (isError || !recipe) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const notFound = status !== undefined && status >= 400 && status < 500;
    return (
      <div className="recipe-detail">
        <RecipeBackLink />
        <RecipeDetailError notFound={notFound} onRetry={() => void refetch()} retrying={isFetching} />
      </div>
    );
  }

  const servings = servingChoice?.recipeId === recipe.id ? servingChoice.servings : recipe.servings;
  const changeServings = (next: number) => setServingChoice({ recipeId: recipe.id, servings: clampServings(next, recipe.servings) });

  return (
    <div className="recipe-detail">
      <nav aria-label="Điều hướng công thức"><RecipeBackLink /></nav>
      <RecipeDetailHero recipe={recipe} alerts={!recipe.hidden && <RecipeForYouAlerts data={forYou.data} />} />
      <RecipeNutritionStrip recipe={recipe} />

      <div className={recipe.hidden ? "recipe-detail__body recipe-detail__body--single" : "recipe-detail__body"}>
        <div className="recipe-detail__main">
          <RecipeIngredientsCard
            ingredients={recipe.ingredients} recipeServings={recipe.servings} servings={servings} onServingsChange={changeServings}
          />
          <RecipeStepsCard instructions={recipe.instructions} />
        </div>
        {!recipe.hidden && (
          <div className="recipe-detail__side">
            <RecipeForYouCard
              data={forYou.data}
              isLoading={forYou.isLoading}
              isError={forYou.isError}
              onRetry={() => void forYou.refetch()}
              sharePath={communityShareRecipePath(recipe.id)}
              onAddToPlan={() => { setAddError(""); setAddOpen(true); }}
            />
          </div>
        )}
      </div>
      {!recipe.hidden && <RecipeSuggestions recipeId={recipe.id} recipeName={recipe.name} />}
      {addOpen && (
        <AddToPlanDialog
          recipe={recipe}
          busy={addToPlan.isPending}
          error={addError}
          onClose={() => { if (!addToPlan.isPending) setAddOpen(false); }}
          onSubmit={(input) => addToPlan.mutate({ ...input, recipeId: recipe.id })}
        />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
