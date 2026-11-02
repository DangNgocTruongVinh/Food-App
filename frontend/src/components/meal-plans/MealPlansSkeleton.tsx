import { LoadingState, Skeleton } from "../ui";

/** Đang tải: khung đúng hình trang Thực đơn (đầu trang, thanh 7 ngày, các bữa, cột phải). */
export function MealPlansSkeleton({ label = "Đang tải thực đơn" }: { label?: string }) {
  return (
    <LoadingState label={label}>
      <div className="td-skeleton">
        <div className="td-days" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} kind="block" height={64} />)}</div>
        <div className="td-layout">
          <div className="td-skeleton__meals">{[0, 1, 2].map((index) => <Skeleton key={index} kind="block" height={96} />)}</div>
          <Skeleton kind="block" height={320} />
        </div>
      </div>
    </LoadingState>
  );
}
