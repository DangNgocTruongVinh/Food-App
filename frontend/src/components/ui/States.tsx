import { CircleAlert, RotateCcw } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "../../features/ui/ui.logic";
import { Button } from "./Button";

type SkeletonProps = { kind?: "text" | "title" | "block"; width?: CSSProperties["width"]; height?: CSSProperties["height"]; className?: string };

/** Khối giữ chỗ tĩnh (không chạy lặp), đặt theo đúng hình nội dung sắp hiện. */
export function Skeleton({ kind = "text", width, height, className }: SkeletonProps) {
  return <span aria-hidden="true" className={cx("ui-skeleton", `ui-skeleton--${kind}`, className)} style={{ width, height }} />;
}

type LoadingStateProps = {
  /** Đọc cho trình đọc màn hình, vd. "Đang tải kho thực phẩm". */
  label: string;
  /** text: vài dòng chữ; cards: lưới thẻ ảnh 4:3. Truyền children để tự vẽ skeleton đúng hình trang. */
  shape?: "text" | "cards";
  count?: number;
  children?: ReactNode;
};

export function LoadingState({ label, shape = "text", count = 3, children }: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, index) => index);
  return (
    <div role="status" aria-live="polite" className={cx("ui-loading", !children && shape === "cards" && "ui-loading--cards")}>
      <span className="ui-visually-hidden">{label}</span>
      {children ?? (shape === "cards"
        ? items.map((item) => (
          <div key={item} className="ui-loading__card">
            <Skeleton kind="block" />
            <Skeleton kind="text" width="70%" />
            <Skeleton kind="text" width="40%" />
          </div>
        ))
        : items.map((item) => <Skeleton key={item} kind="text" width={item === count - 1 ? "60%" : "100%"} />))}
    </div>
  );
}

type EmptyStateProps = {
  /** Một câu nói điều gì đang trống, vd. "Kho chưa có thực phẩm nào." */
  message: ReactNode;
  /** Một nút hành động. */
  action?: ReactNode;
  icon?: ReactNode;
};

export function EmptyState({ message, action, icon }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      {icon && <span aria-hidden="true" className="ui-empty__icon">{icon}</span>}
      <p className="ui-empty__message">{message}</p>
      {action}
    </div>
  );
}

type ErrorStateProps = {
  /** Nói điều gì sai, không xin lỗi, không mơ hồ: "Chưa tải được kho thực phẩm." */
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
};

export function ErrorState({ message, onRetry, retryLabel = "Thử lại", retrying }: ErrorStateProps) {
  return (
    <div role="alert" className="ui-error">
      <p className="ui-error__message"><CircleAlert aria-hidden="true" /><span>{message}</span></p>
      {onRetry && <Button icon={<RotateCcw />} onClick={onRetry} busy={retrying}>{retryLabel}</Button>}
    </div>
  );
}
