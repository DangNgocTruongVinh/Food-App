import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListParams,
} from "./notifications.api";

export const notificationQueries = {
  unreadCount: () => queryOptions({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: getUnreadNotificationCount,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  }),
  list: (params: NotificationListParams) => queryOptions({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => listNotifications(params),
    staleTime: 10_000,
  }),
};

export const notificationMutations = {
  markRead: () => mutationOptions({ mutationFn: markNotificationRead }),
  markAllRead: () => mutationOptions({ mutationFn: markAllNotificationsRead }),
};

export async function invalidateNotificationQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.lists }),
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount }),
  ]);
}
