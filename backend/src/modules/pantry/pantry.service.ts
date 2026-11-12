import { prisma } from "../../lib/prisma.js";
import { syncPantryNotifications } from "../notifications/notifications.service.js";
import { HttpError } from "../../utils/http-error.js";
import { manualEditChange, recordPantryChange } from "./pantry-history.service.js";
import type { CreatePantryInput, PantryRemovalReasonInput, UpdatePantryInput } from "./pantry.schema.js";

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
    expiryDate: input.expiryDate === undefined ? undefined : input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null,
  };
}

export function listPantryItems(userId: string) {
  return prisma.pantryItem.findMany({
    where: { userId },
    orderBy: [{ expiryDate: "asc" }, { name: "asc" }],
  });
}

// Kho CRUD ghi lịch sử (pantry-history.service.ts) trong cùng transaction với thay đổi.
export async function createPantryItem(userId: string, input: CreatePantryInput) {
  const item = await prisma.$transaction(async (transaction) => {
    const created = await transaction.pantryItem.create({ data: { userId, ...toCreateData(input) } });
    await recordPantryChange(transaction, { item: created, delta: created.quantity, source: "MANUAL_ADD" });
    return created;
  });
  await syncNotificationsWithoutFailingCrud(userId);
  return item;
}

const sameDay = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

export async function updatePantryItem(userId: string, id: string, input: UpdatePantryInput) {
  const item = await prisma.$transaction(async (transaction) => {
    const current = await transaction.pantryItem.findFirst({ where: { id, userId } });
    if (!current) throw new HttpError(404, "Không tìm thấy thực phẩm.");

    const data = toUpdateData(input);
    // Người dùng đổi hạn thì hạn không còn là ước tính; gửi lại đúng hạn cũ (form gửi đủ trường) thì giữ nguyên cờ.
    const expiryChanged = data.expiryDate !== undefined && !sameDay(data.expiryDate, current.expiryDate);
    const result = await transaction.pantryItem.updateMany({
      where: { id, userId },
      data: expiryChanged ? { ...data, expiryEstimated: false } : data,
    });
    if (!result.count) throw new HttpError(404, "Không tìm thấy thực phẩm.");

    const updated = await transaction.pantryItem.findUnique({ where: { id } });
    if (!updated) throw new HttpError(404, "Không tìm thấy thực phẩm.");
    const change = manualEditChange(current, updated);
    if (change) await recordPantryChange(transaction, change);
    await transaction.notification.deleteMany({
      where: { userId, relatedId: id, type: { in: [...relatedNotificationTypes] } },
    });
    return updated;
  });
  await syncNotificationsWithoutFailingCrud(userId);
  return item;
}

/** Xóa khỏi kho kèm lý do ("Đã dùng hết" / "Bỏ đi" / "Nhập nhầm"), lưu ở dòng lịch sử cho Báo cáo lãng phí. */
export async function deletePantryItem(userId: string, id: string, reason: PantryRemovalReasonInput) {
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.pantryItem.findFirst({ where: { id, userId } });
    if (!current) throw new HttpError(404, "Không tìm thấy thực phẩm.");
    // Ghi trước khi xóa (dòng lịch sử giữ tên, đơn vị; pantryItemId về null khi thực phẩm bị xóa).
    await recordPantryChange(transaction, {
      item: { ...current, quantity: 0 }, delta: -current.quantity, source: "MANUAL_DELETE", removalReason: reason,
    });
    const result = await transaction.pantryItem.deleteMany({ where: { id, userId } });
    if (!result.count) throw new HttpError(404, "Không tìm thấy thực phẩm.");
    await transaction.notification.deleteMany({
      where: { userId, relatedId: id, type: { in: [...relatedNotificationTypes] } },
    });
  });
}
