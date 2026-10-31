import { groupNotifications } from "../../features/notifications/notifications.logic";
import type { AppNotification } from "../../types";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "../ui";
import NotificationItem from "./NotificationItem";

export default function NotificationList({
  notifications,
  isLoading,
  error,
  onRetry,
  onSelect,
}: {
  notifications: AppNotification[];
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
  onSelect: (notification: AppNotification) => void;
}) {
  if (isLoading) {
    return (
      <div className="notification-state">
        <LoadingState label="Đang tải thông báo">
          {[0, 1, 2].map((row) => (
            <div key={row} className="notification-skeleton">
              <Skeleton kind="block" width={36} height={36} />
              <span><Skeleton width="70%" /><Skeleton width="45%" /></span>
            </div>
          ))}
        </LoadingState>
      </div>
    );
  }

  if (error) {
    return <div className="notification-state"><ErrorState message={`Chưa tải được thông báo. ${error}`} onRetry={onRetry} /></div>;
  }

  if (!notifications.length) {
    return <EmptyState message="Không có thông báo nào ở mục này." />;
  }

  return (
    <div className="notification-groups">
      {groupNotifications(notifications).map((group) => (
        <section className="notification-group" key={group.label}>
          <h3>{group.label}</h3>
          <div>{group.items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onSelect={onSelect} />
          ))}</div>
        </section>
      ))}
    </div>
  );
}
