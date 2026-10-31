import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cx } from "../../features/ui/ui.logic";

export type ButtonVariant = "primary" | "secondary" | "danger";

type CommonProps = {
  /** Chính: 1 nút mỗi vùng. Phụ: viền. Nguy hiểm: xóa/khóa. */
  variant?: ButtonVariant;
  /** Icon lucide đặt trước chữ (trang trí, đã aria-hidden). */
  icon?: ReactNode;
  block?: boolean;
};

const buttonClass = (variant: ButtonVariant, block: boolean | undefined, className: string | undefined) =>
  cx("ui-button", `ui-button--${variant}`, block && "ui-button--block", className);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & CommonProps & { busy?: boolean };

/** Nút: chữ là động từ cụ thể ("Lưu vào kho"). busy → khóa nút và báo aria-busy trong lúc chờ. */
export function Button({ variant = "secondary", icon, block, busy, className, children, type = "button", disabled, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, block, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {icon && <span aria-hidden="true" className="ui-button__icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

/** Liên kết điều hướng có hình nút (vd. "Xem công thức"). */
export function ButtonLink({ variant = "secondary", icon, block, className, children, ...rest }: LinkProps & CommonProps) {
  return (
    <Link className={buttonClass(variant, block, className)} {...rest}>
      {icon && <span aria-hidden="true" className="ui-button__icon">{icon}</span>}
      <span>{children}</span>
    </Link>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  /** Bắt buộc: tên đọc cho trình đọc màn hình. */
  label: string;
  icon: ReactNode;
  /** Nút bật/tắt (vd. chế độ tối) → aria-pressed. */
  pressed?: boolean;
  quiet?: boolean;
};

/** Nút chỉ có icon, 44×44. */
export function IconButton({ label, icon, pressed, quiet, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} className={cx("ui-icon-button", quiet && "ui-icon-button--quiet", className)} aria-label={label} aria-pressed={pressed} {...rest}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
