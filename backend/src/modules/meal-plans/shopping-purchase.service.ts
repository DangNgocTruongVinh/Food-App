import type { FoodUnit, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { withFoodCategory } from "../../services/food-category.js";
import { choosePurchaseTarget, suggestedPantryDefaults } from "../../services/pantry-purchase.js";
import { convertQuantity, roundQuantity } from "../../utils/food-units.js";
import { HttpError } from "../../utils/http-error.js";
import { syncPantryNotifications } from "../notifications/notifications.service.js";
import { recordPantryChange } from "../pantry/pantry-history.service.js";

// "Đã mua" → thêm vào kho, bỏ "đã mua" → hoàn lại (GĐ3b lượt 6). Mọi thay đổi kho và lịch sử nằm trong cùng một transaction.

type Tx = Prisma.TransactionClient;
type PurchaseAction = "MERGED" | "REUSED" | "CREATED";
type SkipReason = "DELETED" | "UNIT_MISMATCH" | "CHANGED" | "INSUFFICIENT";

/** Ghi chú của dòng lịch sử khi lần mua tạo thực phẩm mới; bỏ "đã mua" dựa vào đây để biết có được xóa hẳn không. */
export const PURCHASE_CREATED_NOTE = "Tạo mới từ danh sách đi chợ";
export const PURCHASE_REUSED_NOTE = "Dùng lại thực phẩm đã dùng hết";

const activePurchase = (userId: string, shoppingItemId: string) => ({
  userId, shoppingItemId, source: "PURCHASE" as const, reversalOfId: null, reversedAt: null,
});

/** Dòng đi chợ phải thuộc thực đơn của người đang đăng nhập (userId từ JWT); không thì 404, không lộ sự tồn tại. */
async function findOwnedShoppingItem(tx: Tx, userId: string, id: string) {
  const item = await tx.shoppingItem.findFirst({ where: { id, mealPlan: { userId } } });
  if (!item) throw new HttpError(404, "Không tìm thấy nguyên liệu mua sắm.");
  return item;
}

type ShoppingRow = Awaited<ReturnType<typeof findOwnedShoppingItem>>;
const changedPantry = () => new HttpError(409, "Kho vừa thay đổi, vui lòng thử lại.");

/**
 * Đưa lượng vừa mua vào kho: cộng vào thực phẩm cùng tên còn hạn có hạn muộn nhất (quy đổi g↔kg, ml↔l); chỉ còn món cùng tên
 * đã dùng hết thì dùng lại món đó với hạn gợi ý mới; không có thì tạo thực phẩm mới theo nhóm, nơi bảo quản, hạn gợi ý.
 */
async function addPurchase(tx: Tx, userId: string, shopping: ShoppingRow, now: Date) {
  const pantry = await tx.pantryItem.findMany({ where: { userId } });
  const target = choosePurchaseTarget(pantry, shopping.name, shopping.unit, now);
  const suggested = suggestedPantryDefaults(shopping.name, withFoodCategory(shopping).category, now);
  let action: PurchaseAction;
  let item;
  let added: number;
  if (target.kind === "create") {
    action = "CREATED";
    added = roundQuantity(shopping.quantity);
    // createdAt = updatedAt: còn bằng nhau nghĩa là chưa ai sửa thực phẩm này (dùng khi bỏ "đã mua").
    item = await tx.pantryItem.create({
      data: {
        userId, name: shopping.name, unit: shopping.unit, quantity: added, category: suggested.category,
        storageLocation: suggested.storageLocation, expiryDate: suggested.expiryDate, expiryEstimated: suggested.expiryEstimated,
        purchasedAt: now, createdAt: now, updatedAt: now,
      },
    });
  } else {
    action = target.kind === "merge" ? "MERGED" : "REUSED";
    added = roundQuantity(convertQuantity(shopping.quantity, shopping.unit, target.item.unit) ?? 0);
    const quantity = roundQuantity(target.item.quantity + added);
    const data = target.kind === "merge"
      ? { quantity }
      : { quantity, purchasedAt: now, expiryDate: suggested.expiryDate, expiryEstimated: suggested.expiryEstimated };
    const updated = await tx.pantryItem.updateMany({ where: { id: target.item.id, userId, quantity: target.item.quantity }, data });
    if (!updated.count) throw changedPantry();
    item = { ...target.item, ...data };
  }
  await recordPantryChange(tx, {
    item: { id: item.id, userId, name: item.name, quantity: item.quantity, unit: item.unit },
    delta: added,
    source: "PURCHASE",
    shoppingItemId: shopping.id,
    note: action === "CREATED" ? PURCHASE_CREATED_NOTE : action === "REUSED" ? PURCHASE_REUSED_NOTE : null,
  });
  return {
    action, pantryItemId: item.id, name: item.name, quantity: added, unit: item.unit, quantityAfter: item.quantity,
    expiryDate: item.expiryDate, expiryEstimated: item.expiryEstimated,
  };
}

/**
 * Hoàn lại đúng các lần thêm (chưa hoàn) của dòng đi chợ này. Thực phẩm do chính lần mua đó tạo ra và chưa bị thay đổi gì khác
 * (số lượng như lúc thêm, chưa sửa, không có lịch sử nào khác) → xóa hẳn. Còn lại thì trừ theo đơn vị hiện tại, không xuống
 * dưới 0, phần không trừ được thì báo. Dòng gốc được đánh `reversedAt` trước (có điều kiện) nên không hoàn hai lần.
 */
async function restorePurchase(tx: Tx, userId: string, shoppingItemId: string, now: Date) {
  const originals = await tx.pantryTransaction.findMany({ where: activePurchase(userId, shoppingItemId), orderBy: { createdAt: "asc" } });
  const restored: Array<{ pantryItemId: string; name: string; quantity: number; unit: FoodUnit; quantityAfter: number; removed: boolean }> = [];
  const skipped: Array<{ itemName: string; quantity: number; unit: FoodUnit; reason: SkipReason }> = [];
  for (const original of originals) {
    const claimed = await tx.pantryTransaction.updateMany({ where: { id: original.id, reversedAt: null }, data: { reversedAt: now } });
    if (!claimed.count) continue;
    const back = { itemName: original.itemName, quantity: original.delta, unit: original.unit };
    const item = original.pantryItemId ? await tx.pantryItem.findFirst({ where: { id: original.pantryItemId, userId } }) : null;
    if (!item) {
      skipped.push({ ...back, reason: "DELETED" });
      continue;
    }
    const reversal = { source: "PURCHASE" as const, shoppingItemId, reversalOfId: original.id };
    if (original.note === PURCHASE_CREATED_NOTE && await isUntouchedSinceCreated(tx, item, original)) {
      await recordPantryChange(tx, { item: { ...item, quantity: 0 }, delta: -item.quantity, ...reversal });
      const removed = await tx.pantryItem.deleteMany({ where: { id: item.id, userId, quantity: item.quantity } });
      if (!removed.count) throw changedPantry();
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

/** Chưa ai đụng tới thực phẩm kể từ lần mua tạo ra nó: số lượng như lúc thêm, chưa sửa (updatedAt = createdAt), không có lịch sử khác. */
async function isUntouchedSinceCreated(
  tx: Tx, item: { id: string; quantity: number; createdAt: Date; updatedAt: Date }, original: { id: string; quantityAfter: number },
) {
  if (item.quantity !== original.quantityAfter || item.updatedAt.getTime() !== item.createdAt.getTime()) return false;
  const others = await tx.pantryTransaction.count({ where: { pantryItemId: item.id, id: { not: original.id } } });
  return others === 0;
}

async function syncNotificationsQuietly(userId: string) {
  try {
    await syncPantryNotifications(userId);
  } catch (error) {
    console.error("Không thể đồng bộ thông báo Pantry sau khi mua/hoàn kho.", error);
  }
}

/**
 * PATCH /api/meal-plans/shopping/:id { purchased }. true → đánh dấu đã mua và thêm vào kho (chỉ lần chuyển chưa mua → đã mua,
 * nên gửi lại không cộng thêm). false → bỏ đánh dấu và hoàn lại các lần thêm của dòng này.
 */
export async function updateShoppingPurchased(userId: string, id: string, purchased: boolean, now = new Date()) {
  const outcome = await prisma.$transaction(async (tx) => {
    const shopping = await findOwnedShoppingItem(tx, userId, id);
    const owned = { id, mealPlan: { userId } };
    if (purchased) {
      const changed = await tx.shoppingItem.updateMany({ where: { ...owned, purchased: false }, data: { purchased: true } });
      const pantry = changed.count && shopping.quantity > 0 ? await addPurchase(tx, userId, shopping, now) : null;
      return { shopping: { ...shopping, purchased: true }, alreadyPurchased: !changed.count, pantry, restoration: null };
    }
    await tx.shoppingItem.updateMany({ where: { ...owned, purchased: true }, data: { purchased: false } });
    const restoration = await restorePurchase(tx, userId, id, now);
    return { shopping: { ...shopping, purchased: false }, alreadyPurchased: false, pantry: null, restoration };
  });
  const { shopping, ...summary } = outcome;
  if (outcome.pantry || outcome.restoration?.restored.length) await syncNotificationsQuietly(userId);
  return { ...withFoodCategory(shopping), ...summary };
}
