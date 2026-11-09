import { prisma } from "../../lib/prisma.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";
import { HttpError } from "../../utils/http-error.js";
import { getMealPlan } from "./meal-plans.service.js";
import { applyShoppingChanges, pickSwapRecipe, shoppingChangesForSwap } from "./meal-swap.js";

const NOT_FOUND = "Không tìm thấy bữa ăn.";

/**
 * Đổi món một bữa chưa ăn (GĐ3b-R2): chọn món an toàn theo hồ sơ hiện tại (`pickSwapRecipe`), cập nhật bữa và danh sách
 * đi chợ trong cùng transaction. Bữa của người khác hoặc không tồn tại → 404; bữa đã ăn (hoặc vừa được người khác
 * đánh dấu/đổi cùng lúc) → 409. Trả lại thực đơn (dạng như GET /api/meal-plans/:id) kèm tên món cũ và món mới.
 */
export async function swapMealItem(userId: string, id: string) {
  const item = await prisma.mealPlanItem.findFirst({
    where: { id, day: { mealPlan: { userId } } },
    include: {
      recipe: { include: { ingredients: true } },
      day: { include: { mealPlan: { include: { days: { include: { items: true } }, shoppingItems: true } } } },
    },
  });
  if (!item) throw new HttpError(404, NOT_FOUND);
  if (item.completed) throw new HttpError(409, "Bữa này đã ăn. Bỏ đánh dấu đã ăn trước khi đổi món.");

  const plan = item.day.mealPlan;
  const [profile, recipes, pantry] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.recipe.findMany({ where: visibleRecipeWhere, include: { ingredients: true } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
  ]);
  const planCounts = new Map<string, number>();
  plan.days.flatMap((day) => day.items).forEach((meal) => planCounts.set(meal.recipeId, (planCounts.get(meal.recipeId) ?? 0) + 1));
  const sameDay = new Set(plan.days.find((day) => day.id === item.dayId)?.items.filter((meal) => meal.id !== item.id).map((meal) => meal.recipeId));
  const replacement = pickSwapRecipe(
    recipes, profile,
    { recipeId: item.recipeId, calories: item.recipe.calories, mealType: item.mealType },
    { sameDay, planCounts },
  );
  if (!replacement) throw new HttpError(422, "Chưa có món nào hợp với hồ sơ của bạn để đổi cho bữa này.");

  const changes = shoppingChangesForSwap(item.recipe, replacement, item.servings, plan.shoppingItems, pantry);
  await prisma.$transaction(async (transaction) => {
    // Chỉ đổi khi bữa vẫn chưa ăn và vẫn là món cũ (chống ghi đè khi hai thao tác cùng lúc).
    const updated = await transaction.mealPlanItem.updateMany({
      where: { id, completed: false, recipeId: item.recipeId },
      data: { recipeId: replacement.id, calories: Math.round(replacement.calories * item.servings) },
    });
    if (!updated.count) throw new HttpError(409, "Bữa này vừa thay đổi. Tải lại thực đơn rồi thử lại.");
    await applyShoppingChanges(transaction, plan.id, changes);
  });

  return { plan: await getMealPlan(userId, plan.id), from: item.recipe.name, to: replacement.name };
}
