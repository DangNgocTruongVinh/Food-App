import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/client";
import { DashboardHero } from "../components/dashboard/DashboardHero";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { NutritionTodayCard } from "../components/dashboard/NutritionTodayCard";
import { PantrySnapshot } from "../components/dashboard/PantrySnapshot";
import { RecommendedRecipes } from "../components/dashboard/RecommendedRecipes";
import { TodayMealsCard } from "../components/dashboard/TodayMealsCard";
import { WaterTracker } from "../components/dashboard/WaterTracker";
import { Button, ErrorState, PageHeader } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import {
  buildNutritionSummary, dashboardRecipeSearchPath, nextMealId, nextWaterGlasses, orderTodayMeals, type TodayMeal, usableTargets,
} from "../features/dashboard/dashboard.logic";
import { dashboardQueries } from "../features/dashboard/dashboard.queries";
import { invalidateMealPlanQueries, mealPlanMutations, mealPlanQueries } from "../features/meal-plans/meal-plans.queries";
import { greetingForHour } from "../features/ui/ui.logic";

type MealStatus = { kind: "done" | "undone" | "error"; meal: TodayMeal; message?: string };

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [status, setStatus] = useState<MealStatus | null>(null);

  const overview = useQuery(dashboardQueries.overview());
  const planId = overview.data?.activePlan?.id ?? null;
  // Đạm/tinh bột/béo và ảnh món của các bữa hôm nay lấy từ chi tiết thực đơn đang dùng (API có sẵn).
  const plan = useQuery({ ...mealPlanQueries.detail(planId ?? ""), enabled: Boolean(planId) });

  const updateMeal = useMutation({
    ...mealPlanMutations.updateMeal(),
    onSuccess: () => invalidateMealPlanQueries(queryClient, true),
  });

  const setCompleted = (meal: TodayMeal, completed: boolean) => {
    updateMeal.mutate({ id: meal.id, completed }, {
      onSuccess: () => setStatus({ kind: completed ? "done" : "undone", meal }),
      onError: (error) => setStatus({ kind: "error", meal, message: getApiError(error) }),
    });
  };

  const greeting = greetingForHour(new Date().getHours());

  if (overview.isLoading) return <DashboardSkeleton />;
  if (overview.isError || !overview.data) {
    return (
      <div className="dash-page">
        <div className="dash-content dash-content--error">
          <PageHeader size="hero" title={<>Hôm nay<br /><em>nấu gì?</em></>} description={user?.name ? `${greeting}, ${user.name}` : greeting} />
          <ErrorState message="Chưa tải được dữ liệu Tổng quan." onRetry={() => void overview.refetch()} retrying={overview.isFetching} />
        </div>
      </div>
    );
  }

  const data = overview.data;
  const meals = orderTodayMeals(data.todayMeals);
  const targets = usableTargets(data.nutritionTargets);
  const planItems = plan.data?.days.flatMap((day) => day.items);
  const summary = targets ? buildNutritionSummary(meals, targets, planId ? planItems : []) : null;
  const macrosStatus = !planId || plan.isSuccess ? "ready" : plan.isError ? "error" : "loading";

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const path = dashboardRecipeSearchPath(search);
    if (path) navigate(path);
  };

  return (
    <div className="dash-page">
      <DashboardHero greeting={greeting} userName={user?.name} recipes={data.recommendedRecipes} hasProfile={Boolean(targets)} />

      <div className="dash-content">
        <div className="dash-row">
          <NutritionTodayCard summary={summary} macrosStatus={macrosStatus} onRetryMacros={() => void plan.refetch()} />
          <div className="dash-stack">
            <TodayMealsCard
              planId={planId}
              meals={meals}
              nextId={nextMealId(meals)}
              planItems={planItems}
              pendingId={updateMeal.isPending ? updateMeal.variables?.id ?? null : null}
              onMarkEaten={(meal) => setCompleted(meal, true)}
            />
            {status && (
              <p className={status.kind === "error" ? "dash-status dash-status--error" : "dash-status"} role={status.kind === "error" ? "alert" : "status"}>
                {status.kind === "done" && <>Đã đánh dấu đã ăn: {status.meal.recipe.name}.</>}
                {status.kind === "undone" && <>Đã bỏ đánh dấu đã ăn: {status.meal.recipe.name}.</>}
                {status.kind === "error" && <>Chưa cập nhật được bữa {status.meal.recipe.name}. {status.message}</>}
                {status.kind === "done" && (
                  <Button className="dash-status__undo" busy={updateMeal.isPending} onClick={() => setCompleted(status.meal, false)}>Hoàn tác</Button>
                )}
              </p>
            )}
          </div>
        </div>

        <PantrySnapshot pantryCount={data.pantryCount} expiringItems={data.expiringItems} expiredCount={data.expiredCount} />

        <RecommendedRecipes recipes={data.recommendedRecipes} search={search} onSearchChange={setSearch} onSearchSubmit={submitSearch} />

        <WaterTracker glasses={waterGlasses} onAddGlass={() => setWaterGlasses(nextWaterGlasses)} />
      </div>
    </div>
  );
}
