import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { todayFigures } from "../../features/dashboard/dashboard.logic";
import { cx } from "../../features/ui/ui.logic";

/**
 * Dải số liệu dưới đầu trang (kiểu "con số trong ngày" của tạp chí): bốn số thật, ngăn bằng đường mảnh, không thẻ.
 * Ô có `action` (kho trống) hiện nút dẫn tới trang tương ứng thay cho số.
 */
export function DashboardFigures({ figures }: { figures: ReturnType<typeof todayFigures> }) {
  return (
    <section className="dash-figures" aria-label="Số liệu hôm nay">
      <dl className="dash-figures__list">
        {figures.map((figure) => (
          // Giá trị là chữ (vd. "Chưa có thực đơn") thì cỡ nhỏ hơn số.
          <div key={figure.key} className={cx("dash-figure", figure.warn && "dash-figure--warn", !/\d/.test(figure.value) && "dash-figure--text")}>
            <dt>{figure.label}</dt>
            <dd>
              {figure.action ? (
                <Link className="dash-figure__action" to={figure.action.to}><Plus aria-hidden="true" />{figure.action.label}</Link>
              ) : figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
