import { useQuery } from "@tanstack/react-query";
import { AdminWeeklyChart } from "../../components/admin/AdminWeeklyChart";
import { Card, EmptyState, ErrorState, LoadingState, Skeleton } from "../../components/ui";
import { adminQueries } from "../../features/admin/admin.queries";
import { hasWeeklyActivity, statsCards } from "../../features/admin/admin-stats.logic";

/** /admin: 4 số tổng có chú thích thật + biểu đồ 12 tuần. */
export default function AdminStatsPage() {
  const stats = useQuery(adminQueries.stats());
  return (
    <section className="ad-section" aria-labelledby="ad-stats-title">
      <h2 id="ad-stats-title" className="ad-section__title">Thống kê</h2>
      {stats.isLoading ? (
        <LoadingState label="Đang tải thống kê">
          <div className="ad-stats">{[0, 1, 2, 3].map((index) => <Skeleton key={index} kind="block" height={112} />)}</div>
          <Skeleton kind="block" height={360} />
        </LoadingState>
      ) : stats.isError || !stats.data ? (
        <ErrorState message="Chưa tải được thống kê." onRetry={() => void stats.refetch()} retrying={stats.isFetching} />
      ) : (
        <>
          <dl className="ad-stats">
            {statsCards(stats.data.totals).map((card) => (
              <div key={card.key} className="ad-stat">
                <dt className="ad-stat__label">{card.label}</dt>
                <dd className="ad-stat__value">{card.value}</dd>
                <dd className="ad-stat__note">{card.note}</dd>
              </div>
            ))}
          </dl>
          <Card as="section" className="ad-card" aria-labelledby="ad-weekly-title">
            <h3 id="ad-weekly-title" className="ad-card__title">Hoạt động 12 tuần gần nhất</h3>
            {hasWeeklyActivity(stats.data.weekly)
              ? <AdminWeeklyChart weekly={stats.data.weekly} />
              : <EmptyState message="12 tuần gần nhất chưa có người dùng, thực đơn hay bài viết mới." />}
          </Card>
        </>
      )}
    </section>
  );
}
