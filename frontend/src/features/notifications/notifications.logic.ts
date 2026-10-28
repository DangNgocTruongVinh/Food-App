import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { vi } from "date-fns/locale";
import type { AppNotification, NotificationType } from "../../types";

export type NotificationGroup = { label: string; items: AppNotification[] };

export function groupNotifications(notifications: AppNotification[]): NotificationGroup[] {
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

export function unreadBadgeLabel(count: number) {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

export function notificationTone(type: NotificationType) {
  if (type.startsWith("PANTRY_")) return "pantry";
  if (type.startsWith("COMMUNITY_")) return "community";
  if (type.startsWith("AI_")) return "ai";
  return "meal";
}

export function notificationRelativeTime(createdAt: string) {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: vi });
}

export function notificationListLimit(drawerOpen: boolean) {
  return drawerOpen ? 200 : 100;
}

export function notificationActionPath(actionUrl: string | null) {
  return actionUrl?.startsWith("/") ? actionUrl : null;
}

export function shouldMarkNotificationRead(notification: AppNotification) {
  return !notification.isRead;
}
