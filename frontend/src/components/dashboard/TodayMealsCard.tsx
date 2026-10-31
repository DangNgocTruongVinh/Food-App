import { CalendarPlus, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { dashboardMealLabels, formatNumber, type TodayMeal } from "../../features/dashboard/dashboard.logic";
import { recipeDetailPath } from "../../features/recipes/recipes.logic";
import type { MealPlanItem } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { Button, ButtonLink, Card, EmptyState, RecipeImage } from "../ui";

type TodayMealsCardProps = {
  planId: string | null;
  /** Các bữa hôm nay đã sắp theo thứ tự trong ngày. */
  meals: TodayMeal[];
  nextId: string | null;
  /** Bữa trong chi tiết thực đơn (lấy ảnh món đã tải lên); chưa tải thì hiện ô tên món. */
  planItems?: MealPlanItem[];
  pendingId: string | null;
  onMarkEaten: (meal: TodayMeal) => void;
};

export function TodayMealsCard({ planId, meals, nextId, planItems, pendingId, onMarkEaten }: TodayMealsCardProps) {
  const recipeFor = (meal: TodayMeal) => planItems?.find((item) => item.id === meal.id)?.recipe ?? meal.recipe;

  return (
    <Card as="section" className="dash-card" aria-labelledby="dash-meals-title">
      <header className="dash-card__header">
        <h2 id="dash-meals-title" className="ui-section-title">Thực đơn hôm nay</h2>
        {planId && <Link className="ui-link" to={`/meal-plans/${planId}`}>Xem cả tuần</Link>}
      </header>
      {!planId ? (
        <EmptyState
          icon={<CalendarPlus />}
          message="Chưa có thực đơn cho hôm nay."
          action={<ButtonLink variant="primary" to="/meal-plans">Tạo thực đơn</ButtonLink>}
        />
      ) : !meals.length ? (
        <EmptyState message="Thực đơn đang dùng không có bữa nào hôm nay." action={<ButtonLink to={`/meal-plans/${planId}`}>Xem thực đơn</ButtonLink>} />
      ) : (
        <ol className="dash-meals">
          {meals.map((meal) => {
            const isNext = meal.id === nextId;
            return (
              <li key={meal.id} className={isNext ? "dash-meal is-next" : "dash-meal"}>
                <RecipeImage className="dash-meal__image" recipe={recipeFor(meal)} width={IMAGE_WIDTHS.thumb} alt="" />
                <div className="dash-meal__text">
                  <p className="dash-meal__type">
                    <span>{dashboardMealLabels[meal.mealType]}</span>
                    {meal.completed && <span className="dash-meal__state"><Check aria-hidden="true" />Đã ăn</span>}
                    {isNext && <span className="dash-meal__state dash-meal__state--next">Bữa tiếp theo</span>}
                  </p>
                  <Link className="dash-meal__name" to={recipeDetailPath(meal.recipe.id)}>{meal.recipe.name}</Link>
                </div>
                <div className="dash-meal__end">
                  <span className="dash-meal__kcal">{formatNumber(meal.calories)} kcal</span>
                  {isNext && (
                    <Button variant="primary" busy={pendingId === meal.id} onClick={() => onMarkEaten(meal)} aria-label={`Đánh dấu đã ăn: ${meal.recipe.name}`}>
                      Đã ăn
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
