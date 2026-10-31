import { Card, Skeleton } from "../ui";

/** Skeleton đúng hình trang Tổng quan: đầu trang có ảnh, hai thẻ dinh dưỡng/thực đơn, tủ bếp. */
export function DashboardSkeleton() {
  return (
    <div className="dash-page" role="status" aria-live="polite">
      <span className="ui-visually-hidden">Đang tải trang Tổng quan</span>
      <div className="dash-hero" aria-hidden="true">
        <div className="dash-hero__inner">
          <div className="dash-hero__copy">
            <Skeleton width="40%" />
            <Skeleton kind="block" height={132} width="80%" />
            <Skeleton width="90%" />
            <Skeleton width="60%" />
          </div>
        </div>
      </div>
      <div className="dash-content" aria-hidden="true">
        <div className="dash-row">
          <Card className="dash-card"><Skeleton kind="title" width="50%" /><Skeleton kind="block" height={148} /></Card>
          <Card className="dash-card"><Skeleton kind="title" width="50%" /><Skeleton kind="block" height={56} /><Skeleton kind="block" height={56} /></Card>
        </div>
        <Card className="dash-card"><Skeleton kind="title" width="30%" /><Skeleton kind="block" height={120} /></Card>
      </div>
    </div>
  );
}
