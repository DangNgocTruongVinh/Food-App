import { LoadingState, Skeleton } from "../ui";

/** Đang tải: khung đúng hình trang Kho (đầu trang, 4 ô thống kê, bảng, cột phải). */
export function PantrySkeleton() {
  return (
    <div className="kho-view">
      <LoadingState label="Đang tải kho thực phẩm">
        <div className="kho-hero">
          <div className="kho-hero__text">
            <Skeleton kind="title" width="min(420px, 80%)" height={48} />
            <Skeleton width="min(360px, 70%)" />
          </div>
        </div>
        <Skeleton kind="block" height={96} />
        <div className="kho-layout">
          <Skeleton kind="block" height={480} />
          <Skeleton kind="block" height={280} />
        </div>
      </LoadingState>
    </div>
  );
}
