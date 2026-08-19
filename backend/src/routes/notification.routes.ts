import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { syncPantryNotifications } from "../services/notification.service.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
const empty = z.object({});

router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  await syncPantryNotifications(userId);

  const unreadOnly = req.query.filter === "unread";
  const requestedLimit = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200) : 100;
  const notifications = await prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  res.json(notifications);
}));

router.get("/unread-count", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  await syncPantryNotifications(userId);
  res.json({ count: await prisma.notification.count({ where: { userId, isRead: false } }) });
}));

router.patch("/read-all", validate(z.object({ body: empty, params: empty, query: empty })), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const result = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  res.json({ count: result.count });
}));

router.patch("/:id/read", validate(z.object({
  body: empty,
  params: z.object({ id: z.string().cuid() }),
  query: empty,
})), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = String(req.params.id);
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new HttpError(404, "Không tìm thấy thông báo.");

  res.json(notification.isRead
    ? notification
    : await prisma.notification.update({ where: { id }, data: { isRead: true } }));
}));

export default router;
