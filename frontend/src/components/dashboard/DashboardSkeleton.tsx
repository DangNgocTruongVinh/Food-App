import { Skeleton } from "../ui";

/** Skeleton đúng hình trang Tổng quan: đầu trang (chữ + ảnh), dải số liệu, hai cột Hôm nay, dải Tủ bếp. */
export function DashboardSkeleton() {
  return (
    <div className="dash-page" role="status" aria-live="polite">
      <span className="ui-visually-hidden">Đang tải trang Tổng quan</span>
      <div className="dash-hero" aria-hidden="true">
        <div className="dash-hero__inner">
          <div className="dash-hero__copy">
            <Skeleton width="45%" />
            <Skeleton kind="block" height={168} width="80%" />
            <Skeleton kind="title" width="70%" />
            <Skeleton width="90%" />
          </div>
          <div className="dash-hero__media"><Skeleton kind="block" height={420} /></div>
        </div>
      </div>
      <div className="dash-content" aria-hidden="true">
        <Skeleton kind="block" height={96} />
        <div className="dash-today">
          <div className="dash-today__meals">
            <Skeleton kind="title" width="50%" /><Skeleton kind="block" height={72} /><Skeleton kind="block" height={72} />
          </div>
          <div className="dash-today__side"><Skeleton kind="title" width="60%" /><Skeleton kind="block" height={148} /></div>
        </div>
      </div>
    </div>
  );
}
