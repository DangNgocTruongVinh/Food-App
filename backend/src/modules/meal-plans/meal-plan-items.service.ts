import type { FoodUnit, MealType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { foodCategoryOf } from "../../services/food-category.js";
import { normalizeFoodText } from "../../services/dietary.service.js";
import { requiredQuantity } from "../../services/pantry-consumption.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";
import { HttpError } from "../../utils/http-error.js";
import { isRecipeSafe } from "../recommendation/safety.js";
import { getMealPlan } from "./meal-plans.service.js";
import type { AddMealPlanItemInput } from "./meal-plans.schema.js";

type Tx = Prisma.TransactionClient;
type MealPlanItemInput = AddMealPlanItemInput;
type ShoppingNeed = { name: string; quantity: number; unit: FoodUnit };

const planForShopping = {
  days: { include: { items: { include: { recipe: { include: { ingredients: true } } } } } },
  shoppingItems: true,
} as const;

const keyOf = (name: string, unit: FoodUnit) => `${normalizeFoodText(name)}:${unit}`;
const roundQuantity = (value: number) => Math.round(value * 1000) / 1000;

/** Tính lại phần thiếu của toàn bộ thực đơn; dòng đã mua giữ nguyên vì đã được cộng vào kho. */
async function refreshShoppingItems(tx: Tx, userId: string, planId: string) {
  const plan = await tx.mealPlan.findFirst({ where: { id: planId, userId }, include: planForShopping });
  if (!plan) throw new HttpError(404, "Không tìm thấy thực đơn.");
  const pantry = await tx.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } });
  const pantryByKey = new Map<string, number>();
  pantry.forEach((item) => pantryByKey.set(keyOf(item.name, item.unit), (pantryByKey.get(keyOf(item.name, item.unit)) ?? 0) + item.quantity));

  const needs = new Map<string, ShoppingNeed>();
  for (const day of plan.days) {
    for (const item of day.items) {
      for (const ingredient of item.recipe.ingredients) {
        const key = keyOf(ingredient.name, ingredient.unit);
        const quantity = requiredQuantity(ingredient.quantity, item.servings, item.recipe.servings);
        const current = needs.get(key);
        needs.set(key, { name: current?.name ?? ingredient.name, unit: ingredient.unit, quantity: roundQuantity((current?.quantity ?? 0) + quantity) });
      }
    }
  }

  const shortages = new Map<string, ShoppingNeed>();
  for (const [key, need] of needs) {
    const missing = roundQuantity(need.quantity - (pantryByKey.get(key) ?? 0));
    if (missing > 0.01) shortages.set(key, { ...need, quantity: missing });
  }

  const openLines = new Map(plan.shoppingItems.filter((item) => !item.purchased).map((item) => [keyOf(item.name, item.unit), item]));
  for (const [key, line] of openLines) {
    const shortage = shortages.get(key);
    if (!shortage) {
      await tx.shoppingItem.deleteMany({ where: { id: line.id, purchased: false } });
      continue;
    }
    await tx.shoppingItem.updateMany({
      where: { id: line.id, purchased: false },
      data: { name: shortage.name, quantity: shortage.quantity, unit: shortage.unit, category: foodCategoryOf(shortage.name) },
    });
    shortages.delete(key);
  }
  for (const need of shortages.values()) {
    await tx.shoppingItem.create({ data: { mealPlanId: planId, name: need.name, quantity: need.quantity, unit: need.unit, category: foodCategoryOf(need.name) } });
  }
}

export async function addMealPlanItem(userId: string, planId: string, input: MealPlanItemInput) {
  const [plan, recipe, profile] = await Promise.all([
    prisma.mealPlan.findFirst({ where: { id: planId, userId }, select: { id: true, status: true, days: { where: { id: input.dayId }, select: { id: true } } } }),
    prisma.recipe.findFirst({ where: { id: input.recipeId, ...visibleRecipeWhere }, include: { ingredients: true } }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
  ]);
  if (!plan || !plan.days.length) throw new HttpError(404, "Không tìm thấy thực đơn hoặc ngày đã chọn.");
  if (plan.status === "COMPLETED") throw new HttpError(409, "Thực đơn đã hoàn tất, không thể thêm món.");
  if (!recipe) throw new HttpError(404, "Không tìm thấy công thức.");
  if (!isRecipeSafe(recipe, profile, { mealType: input.mealType as MealType })) {
    throw new HttpError(422, "Món này không phù hợp với dị ứng hoặc chế độ ăn trong hồ sơ.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.mealPlanItem.create({
      data: {
        dayId: input.dayId,
        recipeId: input.recipeId,
        mealType: input.mealType,
        servings: input.servings,
        calories: Math.round(recipe.calories * input.servings),
      },
    });
    await refreshShoppingItems(tx, userId, planId);
  });
  return getMealPlan(userId, planId);
}

export async function deleteMealPlanItem(userId: string, itemId: string) {
  const item = await prisma.mealPlanItem.findFirst({
    where: { id: itemId, day: { mealPlan: { userId } } },
    select: { id: true, completed: true, day: { select: { mealPlanId: true } } },
  });
  if (!item) throw new HttpError(404, "Không tìm thấy món trong thực đơn.");
  if (item.completed) throw new HttpError(409, "Bữa đã ăn, không thể xóa món.");

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.mealPlanItem.deleteMany({ where: { id: itemId, completed: false, day: { mealPlan: { userId } } } });
    if (!deleted.count) throw new HttpError(409, "Món vừa thay đổi. Tải lại thực đơn rồi thử lại.");
    await refreshShoppingItems(tx, userId, item.day.mealPlanId);
  });
  return getMealPlan(userId, item.day.mealPlanId);
}
