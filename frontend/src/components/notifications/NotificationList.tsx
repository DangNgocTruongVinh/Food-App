import { isToday, isYesterday } from "date-fns";
import { Bell } from "lucide-react";
import type { AppNotification } from "../../types";
import NotificationItem from "./NotificationItem";

type NotificationGroup = { label: string; items: AppNotification[] };

function groupNotifications(notifications: AppNotification[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [
    { label: "Hôm nay", items: [] },
    { label: "Hôm qua", items: [] },
    { label: "Trước đó", items: [] },
  ];

  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    if (isToday(date)) groups[0].items.push(notification);
    else if (isYesterday(date)) groups[1].items.push(notification);
    else groups[2].items.push(notification);
  });

  return groups.filter((group) => group.items.length > 0);
}

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
      <div className="notification-loading" aria-label="Đang tải thông báo">
        <i /><i /><i />
      </div>
    );
  }

  if (error) {
    return (
      <div className="notification-empty">
        <Bell />
        <strong>Chưa thể tải thông báo</strong>
        <span>{error}</span>
        <button type="button" onClick={onRetry}>Thử lại</button>
      </div>
    );
  }

  if (!notifications.length) {
    return (
      <div className="notification-empty">
        <Bell />
        <strong>Bạn đã xem hết rồi!</strong>
        <span>Hiện tại không có thông báo mới.</span>
      </div>
    );
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
