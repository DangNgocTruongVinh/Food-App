import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WasteReport as WasteData } from "../../features/reports/reports.api";
import { categoryAmount, compareText, formatPercent, formatVnd, shortDate } from "../../features/reports/reports.logic";
import { Card, ChoiceGroup, EmptyState, ErrorState, LoadingState, Skeleton } from "../ui";

const RANGE_OPTIONS = [["4", "4 tuần"], ["8", "8 tuần"]] as const;
const TOOLTIP_STYLE = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)", fontSize: 14 };
const TICK = { fill: "var(--ink-2)", fontSize: 13 };

type WasteReportProps = {
  data: WasteData | undefined;
  weeks: 4 | 8;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  onWeeksChange: (weeks: 4 | 8) => void;
};

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bc-stat">
      <dt className="bc-stat__label">{label}</dt>
      <dd className="bc-stat__value">{value}</dd>
      {note && <dd className="bc-stat__note">{note}</dd>}
    </div>
  );
}

/** Biểu đồ số món bỏ đi (cột) và tỉ lệ dùng trước hạn (đường) theo tuần; bảng số liệu ngay dưới cho trình đọc màn hình. */
function WasteChart({ data }: { data: WasteData }) {
  const rows = data.weeks.map((week) => ({
    label: shortDate(week.start), discarded: week.discarded, onTime: week.onTimeRate === null ? null : Math.round(week.onTimeRate * 100),
  }));
  return (
    <figure className="bc-chart">
      <figcaption className="bc-chart__caption">Mỗi cột là một tuần bắt đầu từ thứ Hai (giờ Việt Nam); tuần cuối là tuần này, chưa trọn.</figcaption>
      <div className="bc-chart__canvas" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted)" tick={TICK} tickLine={false} />
            <YAxis yAxisId="count" allowDecimals={false} stroke="var(--muted)" tick={TICK} tickLine={false} width={32} />
            <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} unit="%" stroke="var(--muted)" tick={TICK} tickLine={false} width={44} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(label) => `Tuần từ ${label}`} />
            <Legend verticalAlign="top" height={32} formatter={(value: string) => <span className="bc-chart__legend-text">{value}</span>} />
            <Bar yAxisId="count" dataKey="discarded" name="Món bỏ đi" fill="var(--warn)" radius={[6, 6, 0, 0]} maxBarSize={36} />
            <Line
              yAxisId="rate" dataKey="onTime" name="Dùng trước hạn (%)" stroke="var(--accent)" strokeWidth={2.5} connectNulls
              dot={{ r: 4, fill: "var(--surface)", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="bc-table-wrap">
        <table className="bc-table">
          <caption className="ui-visually-hidden">Lãng phí thực phẩm theo tuần</caption>
          <thead>
            <tr><th scope="col">Tuần từ</th><th scope="col">Bỏ đi</th><th scope="col">Dùng trước hạn</th><th scope="col">Tiền lãng phí</th></tr>
          </thead>
          <tbody>
            {data.weeks.map((week) => (
              <tr key={week.start}>
                <th scope="row">{shortDate(week.start)}</th>
                <td>{week.discarded} món</td>
                <td>{formatPercent(week.onTimeRate)}</td>
                <td>{week.pricedDiscards ? formatVnd(week.wasteValue) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Báo cáo A — lãng phí thực phẩm: số món bỏ đi, lượng theo nhóm, tiền lãng phí ước tính, tỉ lệ dùng trước hạn, so với tuần trước. */
export function WasteReport({ data, weeks, isLoading, isError, isFetching, onRetry, onWeeksChange }: WasteReportProps) {
  return (
    <Card as="section" className="bc-section" aria-labelledby="bc-waste-title">
      <header className="bc-section__head">
        <div>
          <h2 id="bc-waste-title" className="bc-section__title">Lãng phí thực phẩm</h2>
          <p className="ui-small">Tính từ lịch sử kho: món xóa với lý do “Bỏ đi”, và các lần dùng (đã ăn, đã dùng hết). “Nhập nhầm” không được tính.</p>
        </div>
        <ChoiceGroup
          legend="Khoảng thời gian" name="bc-waste-range" options={RANGE_OPTIONS} value={String(weeks)}
          onChange={(value) => onWeeksChange(value === "8" ? 8 : 4)}
        />
      </header>
      {isLoading ? (
        <LoadingState label="Đang tải báo cáo lãng phí"><Skeleton kind="block" height={320} /></LoadingState>
      ) : isError || !data ? (
        <ErrorState message="Chưa tải được báo cáo lãng phí." onRetry={onRetry} retrying={isFetching} />
      ) : !data.hasData ? (
        <EmptyState message={`Chưa đủ dữ liệu: ${weeks} tuần qua chưa có món nào được dùng hay bỏ đi. Khi xóa món khỏi kho, hãy chọn lý do.`} />
      ) : (
        <>
          <dl className="bc-stats">
            <Stat
              label={`Món bỏ đi (${weeks} tuần)`} value={`${data.totals.discarded} món`}
              note={data.comparison ? `Tuần này: ${compareText(data.comparison.discarded, "count")}` : undefined}
            />
            <Stat
              label="Dùng trước hạn" value={formatPercent(data.totals.onTimeRate)}
              note={data.comparison ? `Tuần này: ${compareText(data.comparison.onTimeRate, "rate")}` : undefined}
            />
            <Stat
              label="Tiền lãng phí ước tính" value={data.totals.pricedDiscards ? formatVnd(data.totals.wasteValue) : "—"}
              note={`Ước tính trên ${data.totals.pricedDiscards}/${data.totals.discarded} món bỏ đi có giá.`}
            />
            <Stat label="Nhóm hay bị bỏ nhất" value={data.topCategory ?? "—"} />
          </dl>
          <WasteChart data={data} />
          {data.byCategory.length > 0 && (
            <div className="bc-table-wrap">
              <table className="bc-table">
                <caption className="bc-table__caption">Lượng bỏ đi theo nhóm thực phẩm ({weeks} tuần)</caption>
                <thead><tr><th scope="col">Nhóm</th><th scope="col">Số món</th><th scope="col">Lượng</th></tr></thead>
                <tbody>
                  {data.byCategory.map((entry) => (
                    <tr key={entry.category}><th scope="row">{entry.category}</th><td>{entry.count}</td><td>{categoryAmount(entry)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
