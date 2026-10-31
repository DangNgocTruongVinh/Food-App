import type { HTMLAttributes } from "react";
import { cx } from "../../features/ui/ui.logic";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside";
  /** flush: không đệm (ảnh tràn mép); quiet: khối phụ nền surface-2, không viền. */
  variant?: "default" | "flush" | "quiet";
};

/** Card: nền surface, viền mảnh, bo 16px, không bóng. Không lồng card trong card. */
export function Card({ as: Tag = "div", variant = "default", className, ...rest }: CardProps) {
  return <Tag className={cx("ui-card", variant !== "default" && `ui-card--${variant}`, className)} {...rest} />;
}
