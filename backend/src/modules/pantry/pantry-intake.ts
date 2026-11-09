import type { FoodUnit, PantryTransaction, Prisma, StorageLocation } from "@prisma/client";
import { choosePurchaseTarget } from "../../services/pantry-purchase.js";
import { convertQuantity, roundQuantity } from "../../utils/food-units.js";
import { HttpError } from "../../utils/http-error.js";
import { syncPantryNotifications } from "../notifications/notifications.service.js";
import { recordPantryChange } from "./pantry-history.service.js";

// Nhập hàng vào kho và hoàn lại, dùng chung cho "Đã mua" (GĐ3b lượt 6, shopping-purchase.service.ts) và lưu lô quét hóa đơn
// (GĐ3c, receipt-scan.service.ts). Luôn gọi bằng `tx` của transaction đang thay đổi kho.

type Tx = Prisma.TransactionClient;
export type IntakeAction = "MERGED" | "REUSED" | "CREATED";
export type IntakeSkipReason = "DELETED" | "UNIT_MISMATCH" | "CHANGED" | "INSUFFICIENT";

/** Dòng hàng cần nhập; nhóm, nơi bảo quản và hạn đã quyết định sẵn (gợi ý theo nhóm hoặc người dùng sửa ở màn duyệt). */
export type IntakeInput = {
  name: string; quantity: number; unit: FoodUnit; category: string; storageLocation: StorageLocation;
  expiryDate: Date | null; expiryEstimated: boolean;
};

/** Nguồn của dòng lịch sử và ghi chú khi tạo mới/dùng lại (hoàn tác dựa vào ghi chú "tạo mới" để biết có được xóa hẳn không). */
export type IntakeLink = {
  source: "PURCHASE" | "RECEIPT_SCAN";
  shoppingItemId?: string;
  receiptScanId?: string;
  createdNote: string;
  reusedNote: string;
};

export const REUSED_DEPLETED_NOTE = "Dùng lại thực phẩm đã dùng hết";
export const changedPantryError = () => new HttpError(409, "Kho vừa thay đổi, vui lòng thử lại.");

/**
 * Đưa hàng vào kho: cộng vào thực phẩm cùng tên còn hạn có hạn muộn nhất (quy đổi g↔kg, ml↔l; giữ hạn cũ); chỉ còn món cùng
 * tên đã dùng hết thì dùng lại món đó (đặt số lượng, hạn mới); không có thì tạo thực phẩm mới. Ghi lịch sử trong cùng `tx`.
 */
export async function addToPantry(tx: Tx, userId: string, input: IntakeInput, link: IntakeLink, now: Date) {
  const pantry = await tx.pantryItem.findMany({ where: { userId } });
  const target = choosePurchaseTarget(pantry, input.name, input.unit, now);
  let action: IntakeAction;
  let item;
  let added: number;
  if (target.kind === "create") {
    action = "CREATED";
    added = roundQuantity(input.quantity);
    // createdAt = updatedAt: còn bằng nhau nghĩa là chưa ai sửa thực phẩm này (dùng khi hoàn tác).
    item = await tx.pantryItem.create({
      data: {
        userId, name: input.name, unit: input.unit, quantity: added, category: input.category, storageLocation: input.storageLocation,
        expiryDate: input.expiryDate, expiryEstimated: input.expiryDate ? input.expiryEstimated : false,
        purchasedAt: now, createdAt: now, updatedAt: now,
      },
    });
  } else {
    action = target.kind === "merge" ? "MERGED" : "REUSED";
    added = roundQuantity(convertQuantity(input.quantity, input.unit, target.item.unit) ?? 0);
    const quantity = roundQuantity(target.item.quantity + added);
    const data = target.kind === "merge"
      ? { quantity }
      : { quantity, purchasedAt: now, expiryDate: input.expiryDate, expiryEstimated: input.expiryDate ? input.expiryEstimated : false };
    const updated = await tx.pantryItem.updateMany({ where: { id: target.item.id, userId, quantity: target.item.quantity }, data });
    if (!updated.count) throw changedPantryError();
    item = { ...target.item, ...data };
  }
  await recordPantryChange(tx, {
    item: { id: item.id, userId, name: item.name, quantity: item.quantity, unit: item.unit },
    delta: added,
    source: link.source,
    shoppingItemId: link.shoppingItemId ?? null,
    receiptScanId: link.receiptScanId ?? null,
    note: action === "CREATED" ? link.createdNote : action === "REUSED" ? link.reusedNote : null,
  });
  return {
    action, pantryItemId: item.id, name: item.name, quantity: added, unit: item.unit, quantityAfter: item.quantity,
    expiryDate: item.expiryDate, expiryEstimated: item.expiryEstimated,
  };
}

/**
 * Hoàn lại các dòng nhập (chưa hoàn). Thực phẩm do chính dòng đó tạo ra và chưa bị thay đổi gì khác (số lượng như lúc thêm,
 * chưa sửa, không có lịch sử nào khác) → xóa hẳn. Còn lại thì trừ theo đơn vị hiện tại, không xuống dưới 0, phần không trừ
 * được thì báo. Dòng gốc được đánh `reversedAt` trước (có điều kiện) nên không hoàn hai lần.
 */
export async function reversePantryIntake(tx: Tx, userId: string, originals: PantryTransaction[], link: IntakeLink, now: Date) {
  const restored: Array<{ pantryItemId: string; name: string; quantity: number; unit: FoodUnit; quantityAfter: number; removed: boolean }> = [];
  const skipped: Array<{ itemName: string; quantity: number; unit: FoodUnit; reason: IntakeSkipReason }> = [];
  for (const original of originals) {
    const claimed = await tx.pantryTransaction.updateMany({ where: { id: original.id, reversedAt: null }, data: { reversedAt: now } });
    if (!claimed.count) continue;
    const back = { itemName: original.itemName, quantity: original.delta, unit: original.unit };
    const item = original.pantryItemId ? await tx.pantryItem.findFirst({ where: { id: original.pantryItemId, userId } }) : null;
    if (!item) {
      skipped.push({ ...back, reason: "DELETED" });
      continue;
    }
    const reversal = {
      source: link.source, shoppingItemId: link.shoppingItemId ?? null, receiptScanId: link.receiptScanId ?? null, reversalOfId: original.id,
    };
    if (original.note === link.createdNote && await isUntouchedSinceCreated(tx, item, original)) {
      await recordPantryChange(tx, { item: { ...item, quantity: 0 }, delta: -item.quantity, ...reversal });
      const removed = await tx.pantryItem.deleteMany({ where: { id: item.id, userId, quantity: item.quantity } });
      if (!removed.count) throw changedPantryError();
      restored.push({ pantryItemId: item.id, name: item.name, quantity: item.quantity, unit: item.unit, quantityAfter: 0, removed: true });
      continue;
    }
    const amount = convertQuantity(back.quantity, back.unit, item.unit);
    if (amount === null) {
      skipped.push({ ...back, reason: "UNIT_MISMATCH" });
      continue;
    }
    const take = roundQuantity(Math.min(amount, item.quantity));
    if (take > 0) {
      const after = roundQuantity(item.quantity - take);
      const updated = await tx.pantryItem.updateMany({ where: { id: item.id, userId, quantity: item.quantity }, data: { quantity: after } });
      if (!updated.count) {
        skipped.push({ ...back, reason: "CHANGED" });
        continue;
      }
      await recordPantryChange(tx, { item: { ...item, quantity: after }, delta: -take, ...reversal });
      restored.push({ pantryItemId: item.id, name: item.name, quantity: take, unit: item.unit, quantityAfter: after, removed: false });
    }
    const missing = roundQuantity(amount - take);
    if (missing > 0) skipped.push({ itemName: item.name, quantity: missing, unit: item.unit, reason: "INSUFFICIENT" });
  }
  return { restored, skipped };
}

/** Chưa ai đụng tới thực phẩm kể từ lần nhập tạo ra nó: số lượng như lúc thêm, chưa sửa (updatedAt = createdAt), không có lịch sử khác. */
async function isUntouchedSinceCreated(
  tx: Tx, item: { id: string; quantity: number; createdAt: Date; updatedAt: Date }, original: { id: string; quantityAfter: number },
) {
  if (item.quantity !== original.quantityAfter || item.updatedAt.getTime() !== item.createdAt.getTime()) return false;
  const others = await tx.pantryTransaction.count({ where: { pantryItemId: item.id, id: { not: original.id } } });
  return others === 0;
}

export async function syncPantryNotificationsQuietly(userId: string) {
  try {
    await syncPantryNotifications(userId);
  } catch (error) {
    console.error("Không thể đồng bộ thông báo Pantry sau khi thay đổi kho.", error);
  }
}
