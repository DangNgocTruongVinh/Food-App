import { cx } from "../../features/ui/ui.logic";

/** Logo chữ "nouri." (Fraunces nghiêng, dấu chấm màu accent). Đặt trong liên kết thì liên kết cần aria-label riêng. */
export function Logo({ className }: { className?: string }) {
  return <span className={cx("ui-logo", className)}>nouri<span aria-hidden="true" className="ui-logo__dot">.</span></span>;
}
