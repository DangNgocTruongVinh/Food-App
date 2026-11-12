import { CalendarDays, Flame } from "lucide-react";
import { HERO_MEAL_PLAN } from "../../features/landing/landing.data";
import { mealLabels } from "../../features/meal-plans/meal-plans.logic";
import { cx } from "../../features/ui/ui.logic";

const total = HERO_MEAL_PLAN.meals.reduce((sum, meal) => sum + meal.calories, 0).toLocaleString("vi-VN");
const label = `Minh họa màn Thực đơn tuần của Nouri, ngày ${HERO_MEAL_PLAN.day}: `
  + `${HERO_MEAL_PLAN.meals.map((meal) => `${mealLabels[meal.mealType].toLowerCase()} ${meal.name} ${meal.calories} kcal`).join(", ")}; `
  + `tổng ${total} kcal.`;

/**
 * Khung điện thoại vẽ bằng HTML/CSS (không phải ảnh): màn Thực đơn tuần, dải 7 ngày và ba bữa của một ngày mẫu.
 * Cả khối là một hình minh họa (role="img" + aria-label), nội dung bên trong không đọc riêng.
 */
export function HeroMealPlanMockup() {
  return (
    <div className="ld-phone" role="img" aria-label={label}>
      <div className="ld-phone__screen">
        <div className="ld-phone__bar">
          <CalendarDays aria-hidden="true" />
          <span>Thực đơn tuần này</span>
        </div>
        <div className="ld-phone__days">
          {HERO_MEAL_PLAN.days.map((day) => (
            <span key={day} className={cx("ld-phone__day", day === HERO_MEAL_PLAN.day && "ld-phone__day--active")}>{day}</span>
          ))}
        </div>
        <ul className="ld-phone__list">
          {HERO_MEAL_PLAN.meals.map((meal) => (
            <li key={meal.mealType} className="ld-phone__row">
              <span className="ld-phone__name"><small>{mealLabels[meal.mealType]}</small>{meal.name}</span>
              <span className="ld-phone__chip">{meal.calories} kcal</span>
            </li>
          ))}
        </ul>
        <div className="ld-phone__suggest">
          <Flame aria-hidden="true" />
          <span><strong>Tổng {total} kcal</strong>Theo calo, chế độ ăn và dị ứng của bạn</span>
        </div>
      </div>
    </div>
  );
}
