import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../States";

export function RecipeBackLink() {
  return <Link className="button ghost" to="/recipes"><ArrowLeft /> Về danh sách công thức</Link>;
}

type RecipeDetailErrorProps = { notFound: boolean; onRetry: () => void };

/** Trạng thái lỗi của trang chi tiết: 4xx là không tìm thấy, còn lại cho thử lại. */
export function RecipeDetailError({ notFound, onRetry }: RecipeDetailErrorProps) {
  if (notFound) {
    return <EmptyState title="Không tìm thấy công thức" action={<RecipeBackLink />}>
      Công thức này không tồn tại hoặc đã bị xóa.
    </EmptyState>;
  }
  const retry = <button className="button primary" onClick={onRetry}>Thử lại</button>;
  return <EmptyState title="Không tải được công thức" action={retry}>Vui lòng kiểm tra kết nối và thử lại.</EmptyState>;
}
