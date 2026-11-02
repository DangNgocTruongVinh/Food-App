import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AdminStats } from "../../features/admin/admin.api";
import { STATS_SERIES, weekLabel } from "../../features/admin/admin-stats.logic";

// Màu biểu đồ theo DESIGN.md mục 4 (token, đổi theo chế độ sáng/tối); thêm kiểu nét và hình điểm để không phân biệt chỉ bằng màu.
const SERIES_STYLE: Record<(typeof STATS_SERIES)[number]["key"], { color: string; dash?: string; dot: "circle" | "square" | "diamond" }> = {
  users: { color: "var(--accent)", dot: "circle" },
  mealPlans: { color: "var(--warn)", dash: "6 4", dot: "square" },
  posts: { color: "var(--muted)", dash: "2 4", dot: "diamond" },
};

type DotProps = { cx?: number; cy?: number; stroke?: string; shape: "circle" | "square" | "diamond" };
function SeriesDot({ cx = 0, cy = 0, stroke, shape }: DotProps) {
  if (shape === "square") return <rect x={cx - 4} y={cy - 4} width={8} height={8} fill="var(--surface)" stroke={stroke} strokeWidth={2} />;
  if (shape === "diamond") {
    return <path d={`M${cx} ${cy - 5} L${cx + 5} ${cy} L${cx} ${cy + 5} L${cx - 5} ${cy} Z`} fill="var(--surface)" stroke={stroke} strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={4} fill="var(--surface)" stroke={stroke} strokeWidth={2} />;
}

/** Biểu đồ 12 tuần (người dùng, thực đơn, bài viết mới) kèm bảng số liệu ẩn cho trình đọc màn hình. */
export function AdminWeeklyChart({ weekly }: { weekly: AdminStats["weekly"] }) {
  const data = weekly.map((row) => ({ ...row, label: weekLabel(row.weekStart) }));
  return (
    <figure className="ad-chart">
      <figcaption className="ad-chart__caption">Mỗi điểm là số mới trong tuần bắt đầu từ thứ Hai (giờ Việt Nam), 12 tuần gần nhất.</figcaption>
      <div className="ad-chart__canvas" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="var(--muted)"
              tick={{ fill: "var(--ink-2)", fontSize: 13 }}
              tickLine={false}
              label={{ value: "Tuần bắt đầu (thứ Hai)", position: "insideBottom", offset: -16, fill: "var(--ink-2)", fontSize: 13 }}
            />
            <YAxis
              allowDecimals={false}
              stroke="var(--muted)"
              tick={{ fill: "var(--ink-2)", fontSize: 13 }}
              tickLine={false}
              width={48}
              label={{ value: "Số mới", angle: -90, position: "insideLeft", fill: "var(--ink-2)", fontSize: 13 }}
            />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)", fontSize: 14 }}
              labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
              itemStyle={{ color: "var(--ink)" }}
              labelFormatter={(label) => `Tuần từ ${label}`}
            />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: 14 }}
              // Recharts tô chữ chú thích bằng màu đường (style nội tuyến); bọc span riêng để chữ dùng --ink.
              formatter={(value: string) => <span className="ad-chart__legend-text">{value}</span>}
            />
            {STATS_SERIES.map(({ key, label }) => {
              const style = SERIES_STYLE[key];
              return (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  name={label}
                  stroke={style.color}
                  strokeWidth={2.5}
                  strokeDasharray={style.dash}
                  dot={<SeriesDot shape={style.dot} />}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Bọc trong div ẩn: bảng không co về 1px nên tự đặt lớp ẩn lên <table> vẫn làm trang tràn ngang. */}
      <div className="ui-visually-hidden">
      <table>
        <caption>Số mới theo tuần, 12 tuần gần nhất</caption>
        <thead>
          <tr><th scope="col">Tuần từ</th>{STATS_SERIES.map((series) => <th key={series.key} scope="col">{series.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.weekStart}><th scope="row">{row.label}</th>{STATS_SERIES.map((series) => <td key={series.key}>{row[series.key]}</td>)}</tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
