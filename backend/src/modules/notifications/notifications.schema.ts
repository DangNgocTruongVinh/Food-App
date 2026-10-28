import { z } from "zod";

const empty = z.object({});

const notificationListQuery = z.object({
  filter: z.string().optional(),
  limit: z.string().optional(),
});

export const listNotificationsSchema = z.object({
  body: empty,
  params: empty,
  query: notificationListQuery,
});

export const unreadNotificationCountSchema = z.object({
  body: empty,
  params: empty,
  query: empty,
});

export const markAllNotificationsReadSchema = z.object({
  body: empty,
  params: empty,
  query: empty,
});

export const markNotificationReadSchema = z.object({
  body: empty,
  params: z.object({ id: z.string().cuid() }),
  query: empty,
});

export type NotificationListQuery = z.infer<typeof notificationListQuery>;
export type NotificationIdParams = z.infer<typeof markNotificationReadSchema>["params"];
