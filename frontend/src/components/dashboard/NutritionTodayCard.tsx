import { UserRound } from "lucide-react";
import { type buildNutritionSummary, formatNumber, type NutrientProgress } from "../../features/dashboard/dashboard.logic";
import { ButtonLink, Card, EmptyState, ErrorState, Skeleton } from "../ui";
import { CalorieRing } from "./CalorieRing";

type Summary = ReturnType<typeof buildNutritionSummary>;

type NutritionTodayCardProps = {
  /** null: chưa có hồ sơ/chỉ tiêu dinh dưỡng. */
  summary: Summary | null;
  macrosStatus: "loading" | "error" | "ready";
  onRetryMacros: () => void;
};

const MACROS = [
  { key: "protein", label: "Đạm", tone: "protein" },
  { key: "carbs", label: "Tinh bột", tone: "carbs" },
  { key: "fat", label: "Béo", tone: "fat" },
] as const;

function MacroRow({ label, tone, value }: { label: string; tone: string; value: NutrientProgress }) {
  return (
    <div className="dash-macro">
      <dt>{label}</dt>
      <dd>
        <span>{formatNumber(value.consumed)} / {formatNumber(value.target)} g</span>
        <span className="dash-macro__percent">{value.percent}%</span>
      </dd>
      <div className="dash-bar" aria-hidden="true"><span className={`dash-bar__fill dash-bar__fill--${tone}`} style={{ width: `${Math.min(100, value.percent)}%` }} /></div>
    </div>
  );
}

function planNote(summary: Summary) {
  if (!summary.plannedCalories) return "Hôm nay chưa có bữa nào trong thực đơn.";
  const remaining = summary.remainingAfterPlan;
  const tail = remaining >= 0 ? `còn ${formatNumber(remaining)} kcal so với mục tiêu` : `vượt mục tiêu ${formatNumber(-remaining)} kcal`;
  return `Nếu ăn hết các bữa hôm nay: ${formatNumber(summary.plannedCalories)} kcal, ${tail}.`;
}

export function NutritionTodayCard({ summary, macrosStatus, onRetryMacros }: NutritionTodayCardProps) {
  return (
    <Card as="section" className="dash-card" aria-labelledby="dash-nutrition-title">
      <header className="dash-card__header"><h2 id="dash-nutrition-title" className="ui-section-title">Dinh dưỡng hôm nay</h2></header>
      {!summary ? (
        <EmptyState
          icon={<UserRound />}
          message="Bạn chưa có hồ sơ dinh dưỡng nên Nouri chưa tính được mục tiêu calo, đạm, tinh bột và béo."
          action={<ButtonLink variant="primary" to="/profile">Tạo hồ sơ</ButtonLink>}
        />
      ) : (
        <>
          <div className="dash-nutrition">
            <CalorieRing consumed={summary.calories.consumed} target={summary.calories.target} percent={summary.calories.percent} />
            {macrosStatus === "ready" && summary.macros && (
              <dl className="dash-macros">{MACROS.map((macro) => <MacroRow key={macro.key} label={macro.label} tone={macro.tone} value={summary.macros![macro.key]} />)}</dl>
            )}
            {macrosStatus === "loading" && (
              <div className="dash-macros" aria-hidden="true">{MACROS.map((macro) => <Skeleton key={macro.key} kind="title" />)}</div>
            )}
            {macrosStatus === "error" && <ErrorState message="Chưa tải được đạm, tinh bột và béo." onRetry={onRetryMacros} />}
          </div>
          <p className="ui-small dash-card__note">{planNote(summary)}</p>
        </>
      )}
    </Card>
  );
}
