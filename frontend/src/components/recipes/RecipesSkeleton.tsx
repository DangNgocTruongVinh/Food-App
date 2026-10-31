import { LoadingState, Skeleton } from "../ui";

/** Skeleton đúng hình trang Công thức: đầu trang, hàng chip, lưới thẻ 4:3. */
export function RecipesSkeleton() {
  return (
    <div className="recipes-view" role="status" aria-live="polite">
      <span className="ui-visually-hidden">Đang tải công thức</span>
      <div className="recipes-hero" aria-hidden="true">
        <div className="recipes-hero__inner">
          <Skeleton kind="block" height={132} width="70%" />
          <Skeleton width="50%" />
          <Skeleton kind="block" height={56} />
        </div>
      </div>
      <div className="recipes-content" aria-hidden="true">
        <div className="recipes-filters__chips">{[96, 110, 90, 100, 120].map((width) => <Skeleton key={width} kind="block" width={width} height={44} />)}</div>
        <LoadingState label="Đang tải danh sách công thức" shape="cards" count={4} />
      </div>
    </div>
  );
}
