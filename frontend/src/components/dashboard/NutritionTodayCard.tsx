import { UserRound } from "lucide-react";
import { type buildNutritionSummary, formatNumber } from "../../features/dashboard/dashboard.logic";
import { ButtonLink, CalorieRing, EmptyState, ErrorState, MACROS, MacroList, Skeleton } from "../ui";

type Summary = ReturnType<typeof buildNutritionSummary>;

type NutritionTodayCardProps = {
  /** null: chưa có hồ sơ/chỉ tiêu dinh dưỡng. */
  summary: Summary | null;
  macrosStatus: "loading" | "error" | "ready";
  onRetryMacros: () => void;
};

function planNote(summary: Summary) {
  if (!summary.plannedCalories) return "Hôm nay chưa có bữa nào trong thực đơn.";
  const remaining = summary.remainingAfterPlan;
  const tail = remaining >= 0 ? `còn ${formatNumber(remaining)} kcal so với mục tiêu` : `vượt mục tiêu ${formatNumber(-remaining)} kcal`;
  return `Nếu ăn hết các bữa hôm nay: ${formatNumber(summary.plannedCalories)} kcal, ${tail}.`;
}

/** Nửa trái của mảng "Hôm nay": vòng calo đã ăn + đạm/tinh bột/béo, câu dự tính nếu ăn hết các bữa. */
export function NutritionTodayCard({ summary, macrosStatus, onRetryMacros }: NutritionTodayCardProps) {
  return (
    <section className="dash-today__part" aria-labelledby="dash-nutrition-title">
      <header className="dash-today__head"><h2 id="dash-nutrition-title" className="dash-today__title">Dinh dưỡng hôm nay</h2></header>
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
              <MacroList values={summary.macros} />
            )}
            {macrosStatus === "loading" && (
              <div className="ui-macros" aria-hidden="true">{MACROS.map((macro) => <Skeleton key={macro.key} kind="title" />)}</div>
            )}
            {macrosStatus === "error" && <ErrorState message="Chưa tải được đạm, tinh bột và béo." onRetry={onRetryMacros} />}
          </div>
          <p className="dash-today__note">{planNote(summary)}</p>
        </>
      )}
    </section>
  );
}
