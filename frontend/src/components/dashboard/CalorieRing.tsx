import { useEffect, useState } from "react";
import { formatNumber, ringDash } from "../../features/dashboard/dashboard.logic";

const RADIUS = 52;

/**
 * Vòng calo: khi tải trang vòng chạy từ 0 tới giá trị (khoảnh khắc chuyển động duy nhất của trang, CSS tắt khi
 * prefers-reduced-motion). Đánh dấu đã ăn thì vòng chạy tiếp tới giá trị mới.
 */
export function CalorieRing({ consumed, target, percent }: { consumed: number; target: number; percent: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(percent));
    return () => cancelAnimationFrame(frame);
  }, [percent]);
  const { circumference, offset } = ringDash(shown, RADIUS);

  return (
    <div className="dash-ring" role="img" aria-label={`Đã ăn ${formatNumber(consumed)} trên ${formatNumber(target)} kcal, ${percent} phần trăm`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="dash-ring__track" cx="60" cy="60" r={RADIUS} />
        <circle className="dash-ring__value" cx="60" cy="60" r={RADIUS} strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 60 60)" />
      </svg>
      <span className="dash-ring__label" aria-hidden="true">
        <span className="dash-ring__number">{formatNumber(consumed)}</span>
        <span className="dash-ring__target">/ {formatNumber(target)} kcal</span>
      </span>
    </div>
  );
}
