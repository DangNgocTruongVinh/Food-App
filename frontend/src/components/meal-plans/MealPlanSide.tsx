import { UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import type { dayNutrition } from "../../features/meal-plans/meal-plans.logic";
import type { MealPlanSuggestion } from "../../types";
import { ButtonLink, CalorieRing, Card, EmptyState, MacroList } from "../ui";

type DayNutrition = ReturnType<typeof dayNutrition>;

type MealPlanNutritionCardProps = {
  /** null: chưa có hồ sơ/chỉ tiêu dinh dưỡng. */
  nutrition: DayNutrition | null;
  week: { completedMeals: number; totalMeals: number; averageCalories: number };
};

function dayNote(nutrition: DayNutrition) {
  const remaining = nutrition.calories.target - nutrition.calories.consumed;
  const tail = remaining >= 0 ? `còn ${formatNumber(remaining)} kcal so với mục tiêu` : `vượt mục tiêu ${formatNumber(-remaining)} kcal`;
  return `Ăn hết các bữa của ngày: ${formatNumber(nutrition.calories.consumed)} kcal, ${tail}. Đã ăn ${nutrition.eatenCount}/${nutrition.mealCount} bữa.`;
}

/** Tổng dinh dưỡng các bữa của ngày đang chọn so với mục tiêu (cùng vòng/thanh với Tổng quan), kèm số liệu cả tuần. */
export function MealPlanNutritionCard({ nutrition, week }: MealPlanNutritionCardProps) {
  return (
    <Card as="section" className="td-card" aria-labelledby="td-nutrition-title">
      <h2 id="td-nutrition-title" className="td-card__title">Dinh dưỡng trong ngày</h2>
      {!nutrition ? (
        <EmptyState
          icon={<UserRound />}
          message="Bạn chưa có hồ sơ dinh dưỡng nên Nouri chưa so được với mục tiêu calo, đạm, tinh bột và béo."
          action={<ButtonLink variant="primary" to="/profile">Tạo hồ sơ</ButtonLink>}
        />
      ) : (
        <>
          <div className="td-nutrition">
            <CalorieRing
              label="Các bữa trong ngày"
              consumed={nutrition.calories.consumed}
              target={nutrition.calories.target}
              percent={nutrition.calories.percent}
            />
            <MacroList values={nutrition.macros} />
          </div>
          <p className="ui-small">{dayNote(nutrition)}</p>
        </>
      )}
      <dl className="td-week">
        <div><dt>Bữa đã ăn trong tuần</dt><dd>{week.completedMeals}/{week.totalMeals}</dd></div>
        <div><dt>Trung bình mỗi ngày</dt><dd>{formatNumber(week.averageCalories)} kcal</dd></div>
      </dl>
      {nutrition && <Link className="ui-link td-card__link" to="/profile">Xem mục tiêu trong Hồ sơ</Link>}
    </Card>
  );
}

/** Gợi ý dinh dưỡng theo số liệu trung bình của thực đơn (chất xơ, chất béo). */
export function MealPlanSuggestionsCard({ suggestions }: { suggestions: MealPlanSuggestion[] }) {
  return (
    <Card as="section" variant="quiet" className="td-card" aria-labelledby="td-suggestions-title">
      <h2 id="td-suggestions-title" className="td-card__title">Gợi ý cho tuần này</h2>
      <ul className="td-suggestions">{suggestions.map((suggestion) => <li key={suggestion.key}>{suggestion.text}</li>)}</ul>
    </Card>
  );
}
