import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardFigures } from "../components/dashboard/DashboardFigures";
import { DashboardHero } from "../components/dashboard/DashboardHero";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { ConsumeMealDialog } from "../components/meal-plans/ConsumeMealDialog";
import { MealStatusNotice } from "../components/meal-plans/MealStatusNotice";
import { NutritionTodayCard } from "../components/dashboard/NutritionTodayCard";
import { PantrySnapshot } from "../components/dashboard/PantrySnapshot";
import { RecommendedRecipes } from "../components/dashboard/RecommendedRecipes";
import { TodayMealsCard } from "../components/dashboard/TodayMealsCard";
import { WaterTracker } from "../components/dashboard/WaterTracker";
import { ErrorState, PageHeader } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import {
  buildNutritionSummary, dashboardRecipeSearchPath, HERO_RECIPE_LIMIT, heroRecipeCandidates, nextMealId, nextWaterGlasses, orderTodayMeals,
  todayFigures, usableTargets,
} from "../features/dashboard/dashboard.logic";
import { dashboardQueries } from "../features/dashboard/dashboard.queries";
import { mealPlanQueries } from "../features/meal-plans/meal-plans.queries";
import { recommendationQueries } from "../features/recommendations/recommendations.api";
import { useMealConsumption } from "../features/meal-plans/useMealConsumption";
import { greetingForHour } from "../features/ui/ui.logic";
import { recipeSuggestionOptions } from "../features/recipes/recipes.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [waterGlasses, setWaterGlasses] = useState(0);

  const overview = useQuery(dashboardQueries.overview());
  // Gợi ý cho ô tìm món (cùng danh sách với trang Công thức, dùng chung bộ nhớ đệm).
  const allRecipes = useQuery(recipeQueries.list());
  const planId = overview.data?.activePlan?.id ?? null;
  // Đạm/tinh bột/béo và ảnh món của các bữa hôm nay lấy từ chi tiết thực đơn đang dùng (API có sẵn).
  const plan = useQuery({ ...mealPlanQueries.detail(planId ?? ""), enabled: Boolean(planId) });
  // "Đổi món khác" duyệt mọi món phù hợp (bộ gợi ý, ngữ cảnh today), không chỉ 3 món của dashboard API.
  const heroMore = useQuery({ ...recommendationQueries.list({ context: "today", limit: HERO_RECIPE_LIMIT }), enabled: overview.isSuccess });

  // "Đã ăn" mở hộp xem trước trừ kho (dùng chung với trang Thực đơn).
  const consumption = useMealConsumption();

  const greeting = greetingForHour(new Date().getHours());

  // Hook phải gọi trước mọi lệnh return sớm (đặt sau return từng làm trang trắng: React #310).
  const searchOptions = useMemo(() => recipeSuggestionOptions(allRecipes.data ?? []), [allRecipes.data]);
  if (overview.isLoading) return <DashboardSkeleton />;
  if (overview.isError || !overview.data) {
    return (
      <div className="dash-page">
        <div className="dash-content dash-content--error">
          <PageHeader size="hero" title={<>Hôm nay<br />nấu gì?</>} description={user?.name ? `${greeting}, ${user.name}` : greeting} />
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
      <DashboardHero
        greeting={greeting}
        userName={user?.name}
        recipes={heroRecipeCandidates(data.recommendedRecipes, heroMore.data?.items)}
        loadingMore={heroMore.isLoading}
        hasProfile={Boolean(targets)}
      />

      <div className="dash-content">
        <DashboardFigures
          figures={todayFigures({
            hasPlan: Boolean(planId), meals, pantryCount: data.pantryCount, expiringCount: data.expiringItems.length, expiredCount: data.expiredCount,
          })}
        />

        {/* Hôm nay: các bữa (cột chính) | dinh dưỡng + nước (cột phụ, nền dịu). */}
        <div className="dash-today">
          <div className="dash-today__meals">
            <TodayMealsCard
              planId={planId}
              meals={meals}
              nextId={nextMealId(meals)}
              planItems={planItems}
              pendingId={consumption.pendingId}
              onMarkEaten={(meal) => consumption.open({ id: meal.id, recipeName: meal.recipe.name })}
            />
            <MealStatusNotice notice={consumption.notice} busy={consumption.pending} onUndo={(notice) => consumption.undo(notice.target)} />
          </div>
          <aside className="dash-today__side" aria-label="Dinh dưỡng và nước hôm nay">
            <NutritionTodayCard summary={summary} macrosStatus={macrosStatus} onRetryMacros={() => void plan.refetch()} />
            <WaterTracker glasses={waterGlasses} onAddGlass={() => setWaterGlasses(nextWaterGlasses)} />
          </aside>
        </div>

        <PantrySnapshot pantryCount={data.pantryCount} expiringItems={data.expiringItems} expiredCount={data.expiredCount} />

        <RecommendedRecipes
          recipes={data.recommendedRecipes}
          search={search}
          onSearchChange={setSearch}
          onSearchSubmit={submitSearch}
          searchOptions={searchOptions}
          onSearchPick={(value) => { const path = dashboardRecipeSearchPath(value); if (path) navigate(path); }}
        />
      </div>
      {consumption.target && (
        <ConsumeMealDialog
          target={consumption.target}
          busy={consumption.pending}
          error={consumption.confirmError}
          onClose={consumption.close}
          onConfirm={consumption.confirm}
        />
      )}
    </div>
  );
}
