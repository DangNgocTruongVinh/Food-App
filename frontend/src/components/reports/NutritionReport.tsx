import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NutritionReport as NutritionData, NutritionValues } from "../../features/reports/reports.api";
import { nutritionCell, percentOfTarget, shortDate, weekdayName } from "../../features/reports/reports.logic";
import { Card, ChoiceGroup, EmptyState, ErrorState, LoadingState, Skeleton } from "../ui";

export type ReportWeek = "current" | "previous";
const WEEK_OPTIONS = [["current", "Tuần này"], ["previous", "Tuần trước"]] as const;
const TOOLTIP_STYLE = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)", fontSize: 14 };
const TICK = { fill: "var(--ink-2)", fontSize: 13 };
const MACROS: Array<{ key: keyof NutritionValues; label: string; unit: "kcal" | "g"; target: "calories" | "proteinG" | "carbsG" | "fatG" }> = [
  { key: "calories", label: "Calo", unit: "kcal", target: "calories" },
  { key: "proteinG", label: "Đạm", unit: "g", target: "proteinG" },
  { key: "carbsG", label: "Tinh bột", unit: "g", target: "carbsG" },
  { key: "fatG", label: "Béo", unit: "g", target: "fatG" },
];

type NutritionReportProps = {
  data: NutritionData | undefined;
  week: ReportWeek;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  onWeekChange: (week: ReportWeek) => void;
};

/** Calo theo ngày (cột; ngày chưa ghi không có cột) và đường mục tiêu; bảng số liệu ngay dưới. */
function CaloriesChart({ data }: { data: NutritionData }) {
  const rows = data.days.map((day, index) => ({ label: `${weekdayName(index).replace("Thứ ", "T")} ${shortDate(day.date)}`, calories: day.calories }));
  const target = data.targets?.calories ?? null;
  return (
    <figure className="bc-chart">
      <figcaption className="bc-chart__caption">
        Calo các bữa đã đánh dấu “Đã ăn”{target ? `, đường ngang là mục tiêu ${target} kcal/ngày` : ""}. Ngày chưa ghi bữa nào không có cột.
      </figcaption>
      <div className="bc-chart__canvas" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted)" tick={TICK} tickLine={false} interval={0} />
            <YAxis allowDecimals={false} stroke="var(--muted)" tick={TICK} tickLine={false} width={44} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} kcal`, "Calo"]} />
            {target && <ReferenceLine y={target} stroke="var(--accent)" strokeDasharray="6 4" strokeWidth={2} />}
            <Bar dataKey="calories" name="Calo" fill="var(--action)" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bc-table-wrap">
        <table className="bc-table">
          <caption className="ui-visually-hidden">Dinh dưỡng từng ngày</caption>
          <thead>
            <tr><th scope="col">Ngày</th>{MACROS.map((macro) => <th key={macro.key} scope="col">{macro.label}</th>)}</tr>
          </thead>
          <tbody>
            {data.days.map((day, index) => (
              <tr key={day.date} className={day.status === "recorded" ? undefined : "bc-table__muted"}>
                <th scope="row">{weekdayName(index)} {shortDate(day.date)}</th>
                {MACROS.map((macro) => <td key={macro.key}>{nutritionCell(day, day[macro.key], macro.unit)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Báo cáo B — dinh dưỡng tuần từ bữa "Đã ăn" so với mục tiêu hồ sơ; trung bình chỉ tính ngày đã ghi. */
export function NutritionReport({ data, week, isLoading, isError, isFetching, onRetry, onWeekChange }: NutritionReportProps) {
  return (
    <Card as="section" className="bc-section" aria-labelledby="bc-nutrition-title">
      <header className="bc-section__head">
        <div>
          <h2 id="bc-nutrition-title" className="bc-section__title">Dinh dưỡng tuần</h2>
          <p className="ui-small">Từ các bữa đã đánh dấu “Đã ăn” trong thực đơn. Ngày chưa ghi bữa nào hiện “chưa ghi”, không tính là 0.</p>
        </div>
        <ChoiceGroup legend="Tuần" name="bc-nutrition-week" options={WEEK_OPTIONS} value={week} onChange={(value) => onWeekChange(value as ReportWeek)} />
      </header>
      {isLoading ? (
        <LoadingState label="Đang tải báo cáo dinh dưỡng"><Skeleton kind="block" height={320} /></LoadingState>
      ) : isError || !data ? (
        <ErrorState message="Chưa tải được báo cáo dinh dưỡng." onRetry={onRetry} retrying={isFetching} />
      ) : !data.average ? (
        <EmptyState message={`Chưa đủ dữ liệu: ${week === "current" ? "tuần này" : "tuần trước"} chưa có bữa nào được đánh dấu “Đã ăn”.`} />
      ) : (
        <>
          <dl className="bc-stats">
            {MACROS.map((macro) => {
              const value = data.average![macro.key];
              const percent = percentOfTarget(value, data.targets?.[macro.target]);
              return (
                <div key={macro.key} className="bc-stat">
                  <dt className="bc-stat__label">{macro.label} trung bình/ngày</dt>
                  <dd className="bc-stat__value">{value} {macro.unit}</dd>
                  <dd className="bc-stat__note">
                    {percent === null ? "Chưa có mục tiêu trong hồ sơ." : `${percent} % mục tiêu ${data.targets?.[macro.target]} ${macro.unit}.`}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="ui-small">Trung bình trên {data.recordedDays} ngày đã ghi bữa ăn.</p>
          <CaloriesChart data={data} />
        </>
      )}
    </Card>
  );
}
