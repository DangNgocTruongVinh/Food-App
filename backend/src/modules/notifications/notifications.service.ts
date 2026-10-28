import type { PantryItem, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import type { NotificationListQuery } from "./notifications.schema.js";

const DAY_MS = 86_400_000;
const EXPIRY_WINDOW_DAYS = 3;
const DEFAULT_NOTIFICATION_LIMIT = 100;
const MAX_NOTIFICATION_LIMIT = 200;

type PantryNotificationItem = Pick<
  PantryItem,
  "id" | "userId" | "name" | "quantity" | "minimumStock" | "expiryDate" | "updatedAt"
>;

export type NotificationCandidate = Pick<
  Prisma.NotificationCreateManyInput,
  "userId" | "type" | "title" | "message" | "relatedId" | "actionUrl" | "dedupeKey"
>;

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function normalizeNotificationListQuery(query: NotificationListQuery) {
  const unreadOnly = query.filter === "unread";
  const requestedLimit = Number(query.limit ?? DEFAULT_NOTIFICATION_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_NOTIFICATION_LIMIT)
    : DEFAULT_NOTIFICATION_LIMIT;
  return { unreadOnly, limit };
}

export function buildPantryNotificationCandidates(
  items: PantryNotificationItem[],
  now = new Date(),
): NotificationCandidate[] {
  const today = startOfUtcDay(now);
  const expiryLimit = new Date(today.getTime() + EXPIRY_WINDOW_DAYS * DAY_MS);
  const candidates: NotificationCandidate[] = [];

  for (const item of items) {
    if (item.quantity <= 0) continue;
    const actionUrl = `/pantry?item=${encodeURIComponent(item.id)}`;

    if (item.expiryDate) {
      const expiryDay = startOfUtcDay(item.expiryDate);
      if (expiryDay < today) {
        candidates.push({
          userId: item.userId,
          type: "PANTRY_EXPIRED",
          title: "Thực phẩm đã hết hạn",
          message: `${item.name} đã hết hạn. Hãy kiểm tra trước khi sử dụng.`,
          relatedId: item.id,
          actionUrl,
          dedupeKey: `pantry-expired:${item.id}:${isoDay(expiryDay)}`,
        });
      } else if (expiryDay <= expiryLimit) {
        const days = Math.round((expiryDay.getTime() - today.getTime()) / DAY_MS);
        candidates.push({
          userId: item.userId,
          type: "PANTRY_EXPIRING",
          title: "Thực phẩm sắp hết hạn",
          message: days === 0
            ? `${item.name} sẽ hết hạn hôm nay.`
            : `${item.name} sẽ hết hạn sau ${days} ngày.`,
          relatedId: item.id,
          actionUrl,
          dedupeKey: `pantry-expiring:${item.id}:${isoDay(expiryDay)}`,
        });
      }
    }

    if (item.minimumStock > 0 && item.quantity <= item.minimumStock) {
      candidates.push({
        userId: item.userId,
        type: "PANTRY_LOW_STOCK",
        title: "Thực phẩm sắp hết",
        message: `${item.name} đã chạm mức tồn kho tối thiểu.`,
        relatedId: item.id,
        actionUrl,
        dedupeKey: `pantry-low-stock:${item.id}:${item.updatedAt.toISOString()}`,
      });
    }
  }

  return candidates;
}

export async function syncPantryNotifications(userId: string, now = new Date()) {
  const today = startOfUtcDay(now);
  const expiryLimit = new Date(today.getTime() + EXPIRY_WINDOW_DAYS * DAY_MS);
  const items = await prisma.pantryItem.findMany({
    where: {
      userId,
      quantity: { gt: 0 },
      OR: [
        { expiryDate: { lte: expiryLimit } },
        { minimumStock: { gt: 0 } },
      ],
    },
    select: {
      id: true,
      userId: true,
      name: true,
      quantity: true,
      minimumStock: true,
      expiryDate: true,
      updatedAt: true,
    },
  });

  const data = buildPantryNotificationCandidates(items, now);
  if (!data.length) return 0;
  const result = await prisma.notification.createMany({ data, skipDuplicates: true });
  return result.count;
}

export async function listNotifications(userId: string, query: NotificationListQuery) {
  await syncPantryNotifications(userId);
  const { unreadOnly, limit } = normalizeNotificationListQuery(query);
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadNotificationCount(userId: string) {
  await syncPantryNotifications(userId);
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return result.count;
}

export async function markNotificationRead(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw new HttpError(404, "Không tìm thấy thông báo.");
  return notification.isRead
    ? notification
    : prisma.notification.update({ where: { id }, data: { isRead: true } });
}
