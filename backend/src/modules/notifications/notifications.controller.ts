import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type { NotificationIdParams, NotificationListQuery } from "./notifications.schema.js";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function listNotificationsController(
  req: ValidatedRequest<unknown, Record<string, never>, NotificationListQuery>,
  res: Response,
) {
  res.json(await listNotifications(authenticatedUserId(req), req.query));
}

export async function unreadNotificationCountController(req: Request, res: Response) {
  res.json({ count: await getUnreadNotificationCount(authenticatedUserId(req)) });
}

export async function markAllNotificationsReadController(req: Request, res: Response) {
  res.json({ count: await markAllNotificationsRead(authenticatedUserId(req)) });
}

export async function markNotificationReadController(
  req: ValidatedRequest<unknown, NotificationIdParams>,
  res: Response,
) {
  res.json(await markNotificationRead(authenticatedUserId(req), req.params.id));
}
