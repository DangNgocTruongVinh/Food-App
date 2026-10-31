import type { ReactNode } from "react";
import { cx } from "../../features/ui/ui.logic";

type PageHeaderProps = {
  /** H1; được bọc một cụm <em> để in nghiêng màu accent (chỉ một cụm, chỉ ở H1). */
  title: ReactNode;
  /** hero: Tổng quan, Công thức, Landing; page: các trang còn lại. */
  size?: "hero" | "page";
  description?: ReactNode;
  /** 1–2 hành động; tối đa một nút chính. */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, size = "page", description, actions, className }: PageHeaderProps) {
  return (
    <header className={cx("ui-page-header", className)}>
      <div className="ui-page-header__text">
        <h1 className={size === "hero" ? "ui-hero-title" : "ui-title"}>{title}</h1>
        {description && <p className="ui-text">{description}</p>}
      </div>
      {actions && <div className="ui-page-header__actions">{actions}</div>}
    </header>
  );
}
