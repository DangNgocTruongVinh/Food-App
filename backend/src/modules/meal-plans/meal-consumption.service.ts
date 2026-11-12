import type { FoodUnit, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { planConsumption, type ConsumptionLine } from "../../services/pantry-consumption.js";
import { convertQuantity, roundQuantity } from "../../utils/food-units.js";
import { HttpError } from "../../utils/http-error.js";
import { syncPantryNotifications } from "../notifications/notifications.service.js";
import { recordPantryChange } from "../pantry/pantry-history.service.js";
import type { MealConsumptionBody, MealConsumptionInput } from "./meal-plans.schema.js";

// "Đã ăn" → trừ kho, bỏ "đã ăn" → hoàn lại (GĐ3b lượt 3). Mọi thay đổi kho và lịch sử nằm trong cùng một transaction.

type Db = Prisma.TransactionClient | PrismaClient;
type SkipReason = "DELETED" | "UNIT_MISMATCH" | "CHANGED";

const mealItemInclude = { recipe: { include: { ingredients: true } } } as const;
const activeConsumption = (userId: string, mealPlanItemId: string) => ({
  userId, mealPlanItemId, source: "CONSUMPTION" as const, reversalOfId: null, reversedAt: null,
});

/** Bữa ăn phải thuộc thực đơn của người đang đăng nhập (userId từ JWT); không thì 404, không lộ sự tồn tại. */
async function findOwnedMealItem(db: Db, userId: string, id: string) {
  const item = await db.mealPlanItem.findFirst({ where: { id, day: { mealPlan: { userId } } }, include: mealItemInclude });
  if (!item) throw new HttpError(404, "Không tìm thấy bữa ăn.");
  return item;
}

const ingredientsOf = (item: Awaited<ReturnType<typeof findOwnedMealItem>>) => item.recipe.ingredients.map(({ id, name, quantity, unit, optional }) => ({
  id, name, quantity, unit, optional,
}));

/** GET /api/meal-plans/items/:id/consumption-preview: mỗi nguyên liệu một dòng, chưa đổi gì trong kho. */
export async function previewMealConsumption(userId: string, id: string, now = new Date()) {
  const [item, pantry, activeCount] = await Promise.all([
    findOwnedMealItem(prisma, userId, id),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
    prisma.pantryTransaction.count({ where: activeConsumption(userId, id) }),
  ]);
  return {
    mealPlanItemId: item.id,
    completed: item.completed,
    alreadyDeducted: activeCount > 0,
    servings: item.servings,
    recipe: { id: item.recipe.id, name: item.recipe.name, servings: item.recipe.servings },
    lines: planConsumption(ingredientsOf(item), item.servings, item.recipe.servings, pantry, now),
  };
}

/**
 * Trừ kho theo các dòng người dùng xác nhận. Server phân bổ lại trên dữ liệu kho mới nhất (đọc trong transaction);
 * client chỉ gửi lượng muốn trừ cho từng nguyên liệu. Mỗi lần trừ cập nhật có điều kiện "số lượng vẫn như lúc đọc" để hai
 * bữa trừ cùng lúc không ghi đè nhau; điều kiện không khớp thì bỏ qua dòng đó và báo.
 */
async function deductForMeal(
  tx: Db, userId: string, item: Awaited<ReturnType<typeof findOwnedMealItem>>, lines: MealConsumptionInput["lines"], now: Date,
) {
  const ingredients = ingredientsOf(item);
  const known = new Set(ingredients.map((ingredient) => ingredient.id));
  const unknown = lines.find((line) => !known.has(line.ingredientId));
  if (unknown) throw new HttpError(422, "Nguyên liệu không thuộc món của bữa này.", { ingredientId: unknown.ingredientId });

  const amounts = new Map(lines.filter((line) => line.quantity > 0).map((line) => [line.ingredientId, { quantity: line.quantity, unit: line.unit }]));
  const pantry = await tx.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } });
  const quantities = new Map(pantry.map((pantryItem) => [pantryItem.id, pantryItem.quantity]));
  const planned = planConsumption(ingredients.filter((ingredient) => amounts.has(ingredient.id)), item.servings, item.recipe.servings, pantry, now, amounts);

  const result: Array<ConsumptionLine & { skipped: Array<{ pantryItemId: string; reason: SkipReason }> }> = [];
  for (const line of planned) {
    const done = [];
    const skipped: Array<{ pantryItemId: string; reason: SkipReason }> = [];
    for (const deduction of line.deductions) {
      const before = quantities.get(deduction.pantryItemId) ?? 0;
      const after = roundQuantity(before - deduction.quantity);
      const updated = await tx.pantryItem.updateMany({
        where: { id: deduction.pantryItemId, userId, quantity: before },
        data: { quantity: Math.max(0, after) },
      });
      if (!updated.count) {
        skipped.push({ pantryItemId: deduction.pantryItemId, reason: "CHANGED" });
        continue;
      }
      quantities.set(deduction.pantryItemId, Math.max(0, after));
      await recordPantryChange(tx, {
        item: {
          ...pantry.find((pantryItem) => pantryItem.id === deduction.pantryItemId),
          id: deduction.pantryItemId, userId, name: deduction.name, quantity: Math.max(0, after), unit: deduction.unit,
        },
        delta: -deduction.quantity,
        source: "CONSUMPTION",
        mealPlanItemId: item.id,
      });
      done.push({ ...deduction, quantityAfter: Math.max(0, after) });
    }
    result.push({ ...line, deductions: done, skipped });
  }
  return { lines: result, skippedIngredients: ingredients.filter((ingredient) => !amounts.has(ingredient.id)).map(({ id, name }) => ({ ingredientId: id, name })) };
}

/**
 * Hoàn lại đúng các lần trừ (chưa hoàn) của bữa này: cộng lại theo đơn vị hiện tại của thực phẩm (quy đổi được thì đổi,
 * không thì báo), thực phẩm đã bị xóa thì không tạo lại. Dòng gốc được đánh `reversedAt` trước (có điều kiện) nên không
 * hoàn lại hai lần; dòng hoàn lại trỏ về dòng gốc qua `reversalOfId`.
 */
async function restoreForMeal(tx: Db, userId: string, mealPlanItemId: string, now: Date) {
  const originals = await tx.pantryTransaction.findMany({ where: activeConsumption(userId, mealPlanItemId), orderBy: { createdAt: "asc" } });
  const restored: Array<{ pantryItemId: string; name: string; quantity: number; unit: FoodUnit; quantityAfter: number }> = [];
  const skipped: Array<{ itemName: string; quantity: number; unit: FoodUnit; reason: SkipReason }> = [];
  for (const original of originals) {
    const claimed = await tx.pantryTransaction.updateMany({ where: { id: original.id, reversedAt: null }, data: { reversedAt: now } });
    if (!claimed.count) continue;
    const back = { itemName: original.itemName, quantity: -original.delta, unit: original.unit };
    const pantryItem = original.pantryItemId ? await tx.pantryItem.findFirst({ where: { id: original.pantryItemId, userId } }) : null;
    if (!pantryItem) {
      skipped.push({ ...back, reason: "DELETED" });
      continue;
    }
    const amount = convertQuantity(back.quantity, back.unit, pantryItem.unit);
    if (amount === null) {
      skipped.push({ ...back, reason: "UNIT_MISMATCH" });
      continue;
    }
    const after = roundQuantity(pantryItem.quantity + amount);
    const updated = await tx.pantryItem.updateMany({ where: { id: pantryItem.id, userId, quantity: pantryItem.quantity }, data: { quantity: after } });
    if (!updated.count) {
      skipped.push({ ...back, reason: "CHANGED" });
      continue;
    }
    await recordPantryChange(tx, {
      item: { ...pantryItem, quantity: after }, delta: amount, source: "CONSUMPTION", mealPlanItemId, reversalOfId: original.id,
    });
    restored.push({ pantryItemId: pantryItem.id, name: pantryItem.name, quantity: amount, unit: pantryItem.unit, quantityAfter: after });
  }
  return { restored, skipped };
}

async function syncNotificationsQuietly(userId: string) {
  try {
    await syncPantryNotifications(userId);
  } catch (error) {
    console.error("Không thể đồng bộ thông báo Pantry sau khi trừ/hoàn kho.", error);
  }
}

/**
 * PATCH /api/meal-plans/items/:id. completed: true + consumption deduct → đánh dấu và trừ kho (chỉ lần chuyển chưa ăn → đã ăn,
 * nên gửi lại không trừ hai lần); consumption none hoặc bỏ trống → chỉ đánh dấu (client cũ). completed: false → bỏ đánh dấu
 * và hoàn lại các lần trừ của bữa này.
 */
export async function updateMealCompletion(userId: string, id: string, completed: boolean, consumption?: MealConsumptionBody, now = new Date()) {
  const outcome = await prisma.$transaction(async (tx) => {
    const item = await findOwnedMealItem(tx, userId, id);
    const owned = { id, day: { mealPlan: { userId } } };
    if (completed) {
      const changed = await tx.mealPlanItem.updateMany({ where: { ...owned, completed: false }, data: { completed: true } });
      const deducted = changed.count && consumption?.mode === "deduct" ? await deductForMeal(tx, userId, item, consumption.lines, now) : null;
      const updated = await tx.mealPlanItem.findUnique({ where: { id } });
      return { updated, consumption: deducted, alreadyCompleted: !changed.count, restoration: null };
    }
    await tx.mealPlanItem.updateMany({ where: { ...owned, completed: true }, data: { completed: false } });
    const restoration = await restoreForMeal(tx, userId, id, now);
    const updated = await tx.mealPlanItem.findUnique({ where: { id } });
    return { updated, consumption: null, alreadyCompleted: false, restoration };
  });
  const { updated, ...summary } = outcome;
  if (!updated) throw new HttpError(404, "Không tìm thấy bữa ăn.");
  const pantryChanged = outcome.consumption?.lines.some((line) => line.deductions.length) || Boolean(outcome.restoration?.restored.length);
  if (pantryChanged) await syncNotificationsQuietly(userId);
  return { ...updated, ...summary };
}
