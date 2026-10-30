import { ArrowRight, CalendarCheck, Check } from "lucide-react";
import { Link } from "react-router-dom";
import {
  dashboardMealIcon, dashboardMealImage, dashboardMealLabels, dashboardMealTimes,
} from "../../features/dashboard/dashboard.logic";
import type { DashboardData } from "../../types";

type TodayPlanCardProps = { meals: DashboardData["todayMeals"]; completedMeals: number; mealProgress: number };

export default function TodayPlanCard({ meals, completedMeals, mealProgress }: TodayPlanCardProps) {
  return <article className="overview-v2-panel overview-v2-plan">
    <header><div><h2>Kế hoạch hôm nay</h2><p>Hoàn thành {completedMeals}/{meals.length || 3} bữa</p></div><CalendarCheck /></header>
    <div className="overview-v2-plan-progress"><span style={{ width: `${mealProgress}%` }} /><small>{mealProgress}%</small></div>
    {meals.length ? <div className="overview-v2-meal-list">
      {meals.slice(0, 3).map((item) => {
        const MealIcon = dashboardMealIcon(item.mealType);
        return <div className={item.completed ? "completed" : ""} key={item.id}>
          <MealIcon className="overview-v2-meal-period" />
          <time>{dashboardMealTimes[item.mealType]}<small>{dashboardMealLabels[item.mealType]}</small></time>
          <img src={dashboardMealImage(item.recipe.name)} alt="" />
          <div><strong>{item.recipe.name}</strong><small>{item.recipe.prepMinutes + item.recipe.cookMinutes} phút</small></div>
          <span className="overview-v2-meal-status">{item.completed && <Check />}</span>
        </div>;
      })}
    </div> : <div className="overview-v2-meal-empty"><CalendarCheck /><p>Chưa có bữa ăn hôm nay. Hãy để Nouri lên lịch giúp bạn.</p></div>}
    <Link className="overview-v2-plan-link" to="/meal-plans">Xem thực đơn đầy đủ <ArrowRight /></Link>
  </article>;
}
