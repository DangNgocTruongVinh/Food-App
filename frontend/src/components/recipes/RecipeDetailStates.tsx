import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ButtonLink, Card, EmptyState, ErrorState, Skeleton } from "../ui";

export function RecipeBackLink() {
  return <Link className="recipe-back" to="/recipes"><ArrowLeft aria-hidden="true" />Công thức</Link>;
}

/** Skeleton đúng hình trang chi tiết: đầu trang 2 cột, hai cột nội dung. */
export function RecipeDetailSkeleton() {
  return (
    <div className="recipe-detail" role="status" aria-live="polite">
      <span className="ui-visually-hidden">Đang tải công thức</span>
      <div className="recipe-hero" aria-hidden="true">
        <div className="recipe-hero__text"><Skeleton width="30%" /><Skeleton kind="block" height={96} /><Skeleton /><Skeleton width="80%" /></div>
        <Skeleton kind="block" className="recipe-hero__image" />
      </div>
      <div className="recipe-detail__body" aria-hidden="true">
        <div className="recipe-detail__main"><Card><Skeleton kind="title" width="40%" /><Skeleton /><Skeleton /><Skeleton /></Card></div>
        <Card><Skeleton kind="title" width="60%" /><Skeleton /><Skeleton width="70%" /></Card>
      </div>
    </div>
  );
}

type RecipeDetailErrorProps = { notFound: boolean; onRetry: () => void; retrying?: boolean };

/** 4xx: không tìm thấy (có đường về danh sách); lỗi khác: báo lỗi + Thử lại. */
export function RecipeDetailError({ notFound, onRetry, retrying }: RecipeDetailErrorProps) {
  if (notFound) {
    return (
      <Card>
        <EmptyState message="Không tìm thấy công thức này. Có thể món đã bị xóa." action={<ButtonLink to="/recipes" icon={<ArrowLeft />}>Về danh sách công thức</ButtonLink>} />
      </Card>
    );
  }
  return <ErrorState message="Chưa tải được công thức." onRetry={onRetry} retrying={retrying} />;
}
