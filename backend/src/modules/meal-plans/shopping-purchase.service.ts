import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { withFoodCategory } from "../../services/food-category.js";
import { suggestedPantryDefaults } from "../../services/pantry-purchase.js";
import { HttpError } from "../../utils/http-error.js";
import {
  addToPantry, REUSED_DEPLETED_NOTE, reversePantryIntake, syncPantryNotificationsQuietly, type IntakeLink,
} from "../pantry/pantry-intake.js";

// "Đã mua" → thêm vào kho, bỏ "đã mua" → hoàn lại (GĐ3b lượt 6). Mọi thay đổi kho và lịch sử nằm trong cùng một transaction.
// Phần nhập/hoàn kho dùng chung với lưu lô quét hóa đơn (pantry-intake.ts).

type Tx = Prisma.TransactionClient;

/** Ghi chú của dòng lịch sử khi lần mua tạo thực phẩm mới; bỏ "đã mua" dựa vào đây để biết có được xóa hẳn không. */
export const PURCHASE_CREATED_NOTE = "Tạo mới từ danh sách đi chợ";
export const PURCHASE_REUSED_NOTE = REUSED_DEPLETED_NOTE;

const purchaseLink = (shoppingItemId: string): IntakeLink => ({
  source: "PURCHASE", shoppingItemId, createdNote: PURCHASE_CREATED_NOTE, reusedNote: PURCHASE_REUSED_NOTE,
});

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

/** Lượng vừa mua vào kho, với nhóm, nơi bảo quản và hạn gợi ý theo nhóm (khi tạo mới hoặc dùng lại món đã dùng hết). */
function addPurchase(tx: Tx, userId: string, shopping: ShoppingRow, now: Date) {
  const suggested = suggestedPantryDefaults(shopping.name, withFoodCategory(shopping).category, now);
  return addToPantry(tx, userId, {
    name: shopping.name, quantity: shopping.quantity, unit: shopping.unit, category: suggested.category,
    storageLocation: suggested.storageLocation, expiryDate: suggested.expiryDate, expiryEstimated: suggested.expiryEstimated,
  }, purchaseLink(shopping.id), now);
}

/** Hoàn lại đúng các lần thêm (chưa hoàn) của dòng đi chợ này. */
async function restorePurchase(tx: Tx, userId: string, shoppingItemId: string, now: Date) {
  const originals = await tx.pantryTransaction.findMany({ where: activePurchase(userId, shoppingItemId), orderBy: { createdAt: "asc" } });
  return reversePantryIntake(tx, userId, originals, purchaseLink(shoppingItemId), now);
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
  if (outcome.pantry || outcome.restoration?.restored.length) await syncPantryNotificationsQuietly(userId);
  return { ...withFoodCategory(shopping), ...summary };
}
