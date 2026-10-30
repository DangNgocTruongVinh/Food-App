import { AlertTriangle, ArrowRight, CalendarCheck, Flame, Leaf, PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";

type TodayMetricsProps = {
  expiringCount: number;
  pantryCount: number;
  mealCount: number;
  consumedCalories: number;
  calorieTarget: number;
  calorieProgress: number;
};

export default function TodayMetrics(props: TodayMetricsProps) {
  return <section className="overview-v2-today" aria-labelledby="overview-v2-today-title">
    <header><h2 id="overview-v2-today-title">Hôm nay của bạn</h2><Leaf aria-hidden="true" /></header>
    <div className="overview-v2-metrics">
      <article className="overview-v2-metric urgent">
        <span className="overview-v2-metric-icon"><AlertTriangle /></span>
        <strong>{props.expiringCount}</strong>
        <div><b>nguyên liệu</b><small>nên dùng sớm</small></div>
        <Link to="/pantry">Xem chi tiết <ArrowRight /></Link>
      </article>

      <article className="overview-v2-metric">
        <span className="overview-v2-metric-icon pantry"><PackageOpen /></span>
        <strong>{props.pantryCount}</strong>
        <div><b>nguyên liệu</b><small>trong kho</small></div>
      </article>

      <article className="overview-v2-metric">
        <span className="overview-v2-metric-icon meals"><CalendarCheck /></span>
        <strong>{props.mealCount}</strong>
        <div><b>bữa ăn</b><small>hôm nay</small></div>
      </article>

      <article className="overview-v2-metric calories">
        <span className="overview-v2-metric-icon energy"><Flame /></span>
        <div className="overview-v2-calorie-copy"><strong>{props.consumedCalories}</strong><b>/ {props.calorieTarget} kcal</b></div>
        <div className="overview-v2-progress"><span style={{ width: `${props.calorieProgress}%` }} /></div>
        <small>{props.calorieProgress}%</small>
      </article>
    </div>
  </section>;
}
