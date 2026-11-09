import type { FoodUnit, PantryTransactionSource, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { convertQuantity, roundQuantity } from "../../utils/food-units.js";
import type { PantryTransactionsQuery } from "./pantry.schema.js";

type HistoryClient = Prisma.TransactionClient | PrismaClient;
type ItemSnapshot = { id: string; userId: string; name: string; quantity: number; unit: FoodUnit };

export type PantryChange = {
  item: ItemSnapshot;
  delta: number;
  source: PantryTransactionSource;
  note?: string | null;
  mealPlanItemId?: string | null;
  shoppingItemId?: string | null;
  receiptScanId?: string | null;
  reversalOfId?: string | null;
};

/**
 * Ghi một dòng lịch sử kho. Luôn gọi bằng `tx` của transaction đang thay đổi kho: thay đổi lỗi thì không có lịch sử,
 * ghi lịch sử lỗi thì thay đổi bị hủy. `item` là trạng thái SAU thay đổi (quantityAfter = item.quantity).
 */
export function recordPantryChange(db: HistoryClient, change: PantryChange) {
  const { item } = change;
  return db.pantryTransaction.create({
    data: {
      userId: item.userId,
      pantryItemId: item.id,
      itemName: item.name,
      unit: item.unit,
      delta: roundQuantity(change.delta),
      quantityAfter: roundQuantity(item.quantity),
      source: change.source,
      note: change.note ?? null,
      mealPlanItemId: change.mealPlanItemId ?? null,
      shoppingItemId: change.shoppingItemId ?? null,
      receiptScanId: change.receiptScanId ?? null,
      reversalOfId: change.reversalOfId ?? null,
    },
  });
}

const UNIT_LABEL: Record<FoodUnit, string> = { G: "g", KG: "kg", ML: "ml", L: "l", ITEM: "cái", PACKAGE: "gói" };
const amount = (quantity: number, unit: FoodUnit) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(quantity)} ${UNIT_LABEL[unit]}`;

/**
 * Sửa tay: chỉ ghi khi số lượng hoặc đơn vị đổi (đổi tên, hạn, ghi chú thì không). Đổi đơn vị quy đổi được (g → kg):
 * delta theo đơn vị mới. Không quy đổi được (cái → g): coi như đặt lại số lượng, ghi chú nêu số cũ.
 */
export function manualEditChange(before: ItemSnapshot, after: ItemSnapshot): PantryChange | null {
  if (before.quantity === after.quantity && before.unit === after.unit) return null;
  const note = before.unit === after.unit
    ? null
    : `Đổi đơn vị: ${amount(before.quantity, before.unit)} → ${amount(after.quantity, after.unit)}`;
  const previous = convertQuantity(before.quantity, before.unit, after.unit);
  return { item: after, delta: previous === null ? after.quantity : after.quantity - previous, source: "MANUAL_EDIT", note };
}

/** Lịch sử kho của người đang đăng nhập (userId từ JWT), mới nhất trước; lọc theo nguồn và/hoặc một thực phẩm. */
export async function listPantryTransactions(userId: string, query: PantryTransactionsQuery) {
  const where: Prisma.PantryTransactionWhereInput = {
    userId,
    ...(query.source ? { source: query.source } : {}),
    ...(query.pantryItemId ? { pantryItemId: query.pantryItemId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.pantryTransaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true, pantryItemId: true, itemName: true, unit: true, delta: true, quantityAfter: true, source: true, note: true,
        reversalOfId: true, reversedAt: true, createdAt: true, receiptScanId: true,
        mealPlanItem: { select: { id: true, mealType: true, recipe: { select: { name: true } }, day: { select: { date: true, mealPlanId: true } } } },
        shoppingItem: { select: { id: true, name: true, mealPlanId: true } },
      },
    }),
    prisma.pantryTransaction.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
