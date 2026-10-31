import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../../features/ui/ui.logic";

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  selected: boolean;
  /** Số đếm thật (vd. số món của danh mục), bỏ trống nếu không hữu ích. */
  count?: number;
};

/** Chip lọc: nút bật/tắt (aria-pressed); đang chọn nền action, chữ trắng. */
export function Chip({ selected, count, className, children, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} className={cx("ui-chip", className)} aria-pressed={selected} {...rest}>
      <span>{children}</span>
      {count !== undefined && <span className="ui-chip__count">{count}</span>}
    </button>
  );
}

/** Nhãn tĩnh (chế độ ăn, nhóm): nền tag-bg, chữ thường. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("ui-tag", className)}>{children}</span>;
}
