import { useEffect, useState } from "react";
import { formatNumber, type NutrientProgress, ringDash } from "../../features/dashboard/dashboard.logic";

const RADIUS = 52;

type CalorieRingProps = {
  consumed: number;
  target: number;
  percent: number;
  /** Đầu câu đọc cho trình đọc màn hình: "Đã ăn" (Tổng quan), "Thực đơn ngày" (Thực đơn). */
  label?: string;
};

/**
 * Vòng calo dùng chung (Tổng quan, Thực đơn): khi hiện, vòng chạy từ 0 tới giá trị; đổi giá trị thì chạy tiếp
 * (CSS tắt khi prefers-reduced-motion).
 */
export function CalorieRing({ consumed, target, percent, label = "Đã ăn" }: CalorieRingProps) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);
  const { circumference, offset } = ringDash(shown, RADIUS);

  return (
    <div className="ui-ring" role="img" aria-label={`${label} ${formatNumber(consumed)} trên ${formatNumber(target)} kcal, ${percent} phần trăm`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ui-ring__track" cx="60" cy="60" r={RADIUS} />
        <circle className="ui-ring__value" cx="60" cy="60" r={RADIUS} strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 60 60)" />
      </svg>
      <span className="ui-ring__label" aria-hidden="true">
        <span className="ui-ring__number">{formatNumber(consumed)}</span>
        <span className="ui-ring__target">/ {formatNumber(target)} kcal</span>
      </span>
    </div>
  );
}

export const MACROS = [
  { key: "protein", label: "Đạm", tone: "protein" },
  { key: "carbs", label: "Tinh bột", tone: "carbs" },
  { key: "fat", label: "Béo", tone: "fat" },
] as const;

export type MacroValues = Record<(typeof MACROS)[number]["key"], NutrientProgress>;

/** Ba thanh đạm / tinh bột / béo (giá trị / mục tiêu, phần trăm). */
export function MacroList({ values }: { values: MacroValues }) {
  return (
    <dl className="ui-macros">
      {MACROS.map(({ key, label, tone }) => (
        <div key={key} className="ui-macro">
          <dt>{label}</dt>
          <dd>
            <span>{formatNumber(values[key].consumed)} / {formatNumber(values[key].target)} g</span>
            <span className="ui-macro__percent">{values[key].percent}%</span>
          </dd>
          <div className="ui-bar" aria-hidden="true">
            <span className={`ui-bar__fill ui-bar__fill--${tone}`} style={{ width: `${Math.min(100, values[key].percent)}%` }} />
          </div>
        </div>
      ))}
    </dl>
  );
}
