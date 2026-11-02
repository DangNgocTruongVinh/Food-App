import type { PantryCounts, PantryStatFilter } from "../../features/pantry/pantry.logic";
import { Card } from "../ui";

type PantryStatsProps = {
  counts: PantryCounts;
  active: PantryStatFilter | null;
  onSelect: (stat: PantryStatFilter) => void;
};

const STATS: Array<{ key: PantryStatFilter; label: string; note: string }> = [
  { key: "all", label: "Tất cả", note: "Thực phẩm trong kho" },
  { key: "expiring", label: "Sắp hết hạn", note: "Trong 3 ngày tới" },
  { key: "expired", label: "Đã hết hạn", note: "Cần xử lý" },
  { key: "lowStock", label: "Dưới mức tối thiểu", note: "Cần mua thêm" },
];

const statValue = (counts: PantryCounts, key: PantryStatFilter) => (key === "all" ? counts.total : counts[key]);

/** Bốn ô thống kê (số thật), mỗi ô là một nút lọc bật/tắt. */
export function PantryStats({ counts, active, onSelect }: PantryStatsProps) {
  return (
    <Card as="section" variant="flush" className="kho-stats" aria-label="Lọc theo tình trạng kho">
      {STATS.map(({ key, label, note }) => {
        const value = statValue(counts, key);
        const alert = key !== "all" && value > 0;
        return (
          <button key={key} type="button" className="kho-stat" aria-pressed={active === key} onClick={() => onSelect(key)}>
            <span className={alert ? "kho-stat__value kho-stat__value--alert" : "kho-stat__value"}>{value}</span>
            <span className="kho-stat__text">
              <span className="kho-stat__label">{label}</span>
              <span className="kho-stat__note">{note}</span>
            </span>
          </button>
        );
      })}
    </Card>
  );
}
