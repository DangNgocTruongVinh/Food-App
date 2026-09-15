import { prisma } from "../../lib/prisma.js";
import { syncPantryNotifications } from "../../services/notification.service.js";
import { HttpError } from "../../utils/http-error.js";
import type { CreatePantryInput, UpdatePantryInput } from "./pantry.schema.js";

const relatedNotificationTypes = ["PANTRY_EXPIRING", "PANTRY_EXPIRED", "PANTRY_LOW_STOCK"] as const;

async function syncNotificationsWithoutFailingCrud(userId: string) {
  try {
    await syncPantryNotifications(userId);
  } catch (error) {
    console.error("Không thể đồng bộ thông báo Pantry sau khi đã lưu dữ liệu.", error);
  }
}

function toCreateData(input: CreatePantryInput) {
  return {
    ...input,
    expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null,
  };
}

function toUpdateData(input: UpdatePantryInput) {
  return {
    ...input,
    expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : input.expiryDate,
  };
}

export function listPantryItems(userId: string) {
  return prisma.pantryItem.findMany({
    where: { userId },
    orderBy: [{ expiryDate: "asc" }, { name: "asc" }],
  });
}

export async function createPantryItem(userId: string, input: CreatePantryInput) {
  const item = await prisma.pantryItem.create({ data: { userId, ...toCreateData(input) } });
  await syncNotificationsWithoutFailingCrud(userId);
  return item;
}

export async function updatePantryItem(userId: string, id: string, input: UpdatePantryInput) {
  const item = await prisma.$transaction(async (transaction) => {
    const result = await transaction.pantryItem.updateMany({
      where: { id, userId },
      data: toUpdateData(input),
    });
    if (!result.count) throw new HttpError(404, "Không tìm thấy thực phẩm.");

    const updated = await transaction.pantryItem.findUnique({ where: { id } });
    if (!updated) throw new HttpError(404, "Không tìm thấy thực phẩm.");
    await transaction.notification.deleteMany({
      where: { userId, relatedId: id, type: { in: [...relatedNotificationTypes] } },
    });
    return updated;
  });
  await syncNotificationsWithoutFailingCrud(userId);
  return item;
}

export async function deletePantryItem(userId: string, id: string) {
  await prisma.$transaction(async (transaction) => {
    const result = await transaction.pantryItem.deleteMany({ where: { id, userId } });
    if (!result.count) throw new HttpError(404, "Không tìm thấy thực phẩm.");
    await transaction.notification.deleteMany({
      where: { userId, relatedId: id, type: { in: [...relatedNotificationTypes] } },
    });
  });
}
