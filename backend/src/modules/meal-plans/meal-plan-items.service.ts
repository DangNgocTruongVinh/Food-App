import type { MealType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";
import { HttpError } from "../../utils/http-error.js";
import { isRecipeSafe } from "../recommendation/safety.js";
import { getMealPlan } from "./meal-plans.service.js";
import type { AddMealPlanItemInput } from "./meal-plans.schema.js";
import { applyShoppingChanges, shoppingChangesForMeal } from "./meal-swap.js";

// Thêm/xóa món thủ công trong thực đơn (C2). Danh sách đi chợ chỉ đổi theo phần của bữa được thêm/xóa
// (`shoppingChangesForMeal`, cùng cách "Đổi món" ở R2), không tính lại cả tuần: bữa đã ăn (kho đã bị trừ) không quay
// lại danh sách, dòng đã mua giữ nguyên.

/** Thêm công thức có sẵn vào một ngày/bữa (kể cả ngày trống, bữa phụ); món phải qua lọc an toàn của hồ sơ hiện tại. */
export async function addMealPlanItem(userId: string, planId: string, input: AddMealPlanItemInput) {
  const [plan, recipe, profile, pantry] = await Promise.all([
    prisma.mealPlan.findFirst({
      where: { id: planId, userId },
      select: { id: true, status: true, days: { where: { id: input.dayId }, select: { id: true } }, shoppingItems: true },
    }),
    prisma.recipe.findFirst({ where: { id: input.recipeId, ...visibleRecipeWhere }, include: { ingredients: true } }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
  ]);
  if (!plan || !plan.days.length) throw new HttpError(404, "Không tìm thấy thực đơn hoặc ngày đã chọn.");
  if (plan.status === "COMPLETED") throw new HttpError(409, "Thực đơn đã hoàn tất, không thể thêm món.");
  if (!recipe) throw new HttpError(404, "Không tìm thấy công thức.");
  if (!isRecipeSafe(recipe, profile, { mealType: input.mealType as MealType })) {
    throw new HttpError(422, "Món này không phù hợp với dị ứng hoặc chế độ ăn trong hồ sơ.");
  }

  const changes = shoppingChangesForMeal({ added: { recipe, servings: input.servings } }, plan.shoppingItems, pantry);
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
    await applyShoppingChanges(tx, plan.id, changes);
  });
  return getMealPlan(userId, planId);
}

/** Xóa một bữa chưa ăn của chính người dùng; bữa đã ăn → 409 (đã trừ kho, bỏ đánh dấu trước). */
export async function deleteMealPlanItem(userId: string, itemId: string) {
  const item = await prisma.mealPlanItem.findFirst({
    where: { id: itemId, day: { mealPlan: { userId } } },
    include: { recipe: { include: { ingredients: true } }, day: { select: { mealPlanId: true, mealPlan: { select: { shoppingItems: true } } } } },
  });
  if (!item) throw new HttpError(404, "Không tìm thấy món trong thực đơn.");
  if (item.completed) throw new HttpError(409, "Bữa đã ăn, không thể xóa món.");

  // Bỏ bữa chỉ giảm dòng chưa mua, không cần đối chiếu kho.
  const changes = shoppingChangesForMeal({ removed: { recipe: item.recipe, servings: item.servings } }, item.day.mealPlan.shoppingItems, []);
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.mealPlanItem.deleteMany({ where: { id: itemId, completed: false, day: { mealPlan: { userId } } } });
    if (!deleted.count) throw new HttpError(409, "Món vừa thay đổi. Tải lại thực đơn rồi thử lại.");
    await applyShoppingChanges(tx, item.day.mealPlanId, changes);
  });
  return getMealPlan(userId, item.day.mealPlanId);
}
