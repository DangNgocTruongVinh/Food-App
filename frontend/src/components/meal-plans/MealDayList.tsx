import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { alternativeMeals, mealLabels, orderDayMeals, planDayLabels } from "../../features/meal-plans/meal-plans.logic";
import { recipeDetailPath } from "../../features/recipes/recipes.logic";
import type { MealPlan, MealPlanDay, MealPlanItem } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { Button, EmptyState, RecipeImage } from "../ui";

type MealDayListProps = {
  plan: MealPlan;
  day: MealPlanDay;
  isToday: boolean;
  panelId: string;
  labelledBy: string;
  pendingId: string | null;
  onToggle: (item: MealPlanItem, completed: boolean) => void;
};

type EatenButtonProps = { item: MealPlanItem; pendingId: string | null; label: string; primary?: boolean } & Pick<MealDayListProps, "onToggle">;

/** Bữa chưa ăn: "Đã ăn" (nút chính chỉ cho bữa kế tiếp trong ngày); đã ăn: "Bỏ đánh dấu". */
function EatenButton({ item, pendingId, onToggle, label, primary }: EatenButtonProps) {
  return item.completed ? (
    <Button busy={pendingId === item.id} onClick={() => onToggle(item, false)} aria-label={`Bỏ đánh dấu đã ăn: ${label}`}>Bỏ đánh dấu</Button>
  ) : (
    <Button
      variant={primary ? "primary" : "secondary"}
      busy={pendingId === item.id}
      onClick={() => onToggle(item, true)}
      aria-label={`Đánh dấu đã ăn: ${label}`}
    >
      Đã ăn
    </Button>
  );
}

/** Các bữa của ngày đang chọn (sáng, trưa, phụ, tối): ảnh, tên món (link chi tiết), thời gian, calo, "Đã ăn"; món cùng bữa ở ngày khác. */
export function MealDayList({ plan, day, isToday, panelId, labelledBy, pendingId, onToggle }: MealDayListProps) {
  const labels = planDayLabels(day);
  const meals = orderDayMeals(day.items);
  const nextId = meals.find((item) => !item.completed)?.id;
  return (
    <section id={panelId} role="tabpanel" aria-labelledby={labelledBy} className="td-day-panel">
      <h2 className="td-day-panel__title">
        {labels.weekday}, {labels.date}
        {isToday && <span className="td-day-panel__today">Hôm nay</span>}
      </h2>
      {!meals.length ? (
        <EmptyState message="Ngày này chưa có bữa nào trong thực đơn." />
      ) : (
        <ol className="td-meals">
          {meals.map((item) => {
            const others = alternativeMeals(plan, item.mealType, item.id);
            const minutes = item.recipe.prepMinutes + item.recipe.cookMinutes;
            return (
              <li key={item.id} className={item.completed ? "td-meal is-done" : "td-meal"}>
                <RecipeImage className="td-meal__image" recipe={item.recipe} width={IMAGE_WIDTHS.thumb} alt="" />
                <div className="td-meal__text">
                  <p className="td-meal__type">
                    <span>{mealLabels[item.mealType]}</span>
                    {item.completed && <span className="td-meal__state"><Check aria-hidden="true" />Đã ăn</span>}
                  </p>
                  <Link className="td-meal__name" to={recipeDetailPath(item.recipe.id)}>{item.recipe.name}</Link>
                  <p className="td-meal__facts">
                    <span>{formatNumber(item.calories)} kcal</span>
                    <span>{minutes} phút</span>
                    {item.servings !== 1 && <span>{formatNumber(item.servings)} khẩu phần</span>}
                  </p>
                </div>
                <div className="td-meal__action">
                  <EatenButton item={item} pendingId={pendingId} onToggle={onToggle} label={item.recipe.name} primary={item.id === nextId} />
                </div>
                {others.length > 0 && (
                  <details className="td-meal__others">
                    <summary>{mealLabels[item.mealType]} ngày khác trong tuần ({others.length})</summary>
                    <ul>
                      {others.map(({ item: other, day: otherDay }) => {
                        const otherLabels = planDayLabels(otherDay);
                        const name = `${other.recipe.name} (${otherLabels.weekday} ${otherLabels.date})`;
                        return (
                          <li key={other.id} className="td-other">
                            <div className="td-other__text">
                              <Link className="td-other__name" to={recipeDetailPath(other.recipe.id)}>{other.recipe.name}</Link>
                              <span className="td-other__meta">
                                {otherLabels.weekday} {otherLabels.date}, {formatNumber(other.calories)} kcal{other.completed ? ", đã ăn" : ""}
                              </span>
                            </div>
                            <EatenButton item={other} pendingId={pendingId} onToggle={onToggle} label={name} />
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
