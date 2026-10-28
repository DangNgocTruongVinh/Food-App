import { api } from "../../api/client";
import type { AppNotification } from "../../types";

export type NotificationFilter = "all" | "unread";

export interface NotificationListParams {
  filter: NotificationFilter;
  limit: number;
}

export interface NotificationCountResult {
  count: number;
}

export async function listNotifications(params: NotificationListParams) {
  return (await api.get<AppNotification[]>("/notifications", { params })).data;
}

export async function getUnreadNotificationCount() {
  return (await api.get<NotificationCountResult>("/notifications/unread-count")).data;
}

export async function markNotificationRead(id: string) {
  return (await api.patch<AppNotification>(`/notifications/${id}/read`)).data;
}

export async function markAllNotificationsRead() {
  return (await api.patch<NotificationCountResult>("/notifications/read-all")).data;
}
