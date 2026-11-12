import { prisma } from "../../lib/prisma.js";
import { matchRecipeToPantry } from "../../services/recipe-fit.service.js";
import { vietnamToday } from "../../utils/vietnam-date.js";
import { engineRecipeQuery, recommendWithData } from "../recommendation/recommendation.service.js";

const DAY_MS = 86_400_000;
const DASHBOARD_WINDOW_DAYS = 7;
const DASHBOARD_RECOMMENDATIONS = 3;

export async function getDashboard(userId: string, now = new Date()) {
  const inSevenDays = new Date(now.getTime() + DASHBOARD_WINDOW_DAYS * DAY_MS);
  const [profile, pantryCount, expiringItems, expiredCount, activePlan, recipes, pantry] = await Promise.all([
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.count({ where: { userId, quantity: { gt: 0 } } }),
    prisma.pantryItem.findMany({
      where: { userId, quantity: { gt: 0 }, expiryDate: { gte: now, lte: inSevenDays } },
      orderBy: { expiryDate: "asc" },
      take: 5,
    }),
    prisma.pantryItem.count({ where: { userId, quantity: { gt: 0 }, expiryDate: { lt: now } } }),
    prisma.mealPlan.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        startDate: { lte: inSevenDays },
        endDate: { gte: now },
      },
      include: { days: { include: { items: { include: { recipe: true } } } } },
      orderBy: { startDate: "desc" },
    }),
    prisma.recipe.findMany(engineRecipeQuery),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
  ]);
  // Gợi ý "hôm nay nấu gì" bằng bộ trộn 3 thuật toán (GĐ3b-R5, ngữ cảnh today): lọc an toàn theo hồ sơ trước, ưu tiên đồ sắp
  // hết hạn và nguyên liệu trong kho, khẩu vị, người có khẩu vị giống; mỗi món kèm lý do. Dạng trả về giữ như trước.
  const todayDate = vietnamToday(now).getTime();
  const eaten = (activePlan?.days.find((day) => day.date.getTime() === todayDate)?.items ?? []).filter((item) => item.completed);
  const today = {
    calories: eaten.reduce((sum, item) => sum + item.calories, 0),
    proteinG: eaten.reduce((sum, item) => sum + item.recipe.proteinG * item.servings, 0),
    meals: eaten.length,
  };
  const suggestions = await recommendWithData({ userId, recipes, profile, pantry, now, today }, { context: "today", limit: DASHBOARD_RECOMMENDATIONS });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const recommendedRecipes = suggestions.items.map(({ recipe: summary, reason }) => {
    const recipe = byId.get(summary.id)!;
    const match = matchRecipeToPantry(recipe, pantry, now);
    return {
      id: recipe.id,
      name: recipe.name,
      calories: recipe.calories,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      dietTags: recipe.dietTags,
      imageUrl: recipe.imageUrl,
      totalIngredients: match.totalIngredients,
      pantryIngredientCount: match.inPantry.length,
      expiringIngredientCount: match.expiring.length,
      reason,
    };
  });

  const mealItems = activePlan?.days.flatMap((day) => day.items) ?? [];
  const todayKey = now.toISOString().slice(0, 10);
  const todayMeals = activePlan?.days.find((day) => day.date.toISOString().slice(0, 10) === todayKey)?.items ?? [];

  return {
    nutritionTargets: profile ? {
      calories: profile.dailyCalorieTarget,
      proteinG: profile.proteinTargetG,
      carbsG: profile.carbTargetG,
      fatG: profile.fatTargetG,
    } : null,
    pantryCount,
    expiringItems,
    expiredCount,
    recommendedRecipes,
    activePlan: activePlan ? {
      id: activePlan.id,
      name: activePlan.name,
      completionRate: mealItems.length
        ? Math.round(mealItems.filter((item) => item.completed).length / mealItems.length * 100)
        : 0,
    } : null,
    todayMeals: todayMeals.map((item) => ({
      id: item.id,
      mealType: item.mealType,
      calories: item.calories,
      completed: item.completed,
      recipe: {
        id: item.recipe.id,
        name: item.recipe.name,
        prepMinutes: item.recipe.prepMinutes,
        cookMinutes: item.recipe.cookMinutes,
        deleted: Boolean(item.recipe.deletedAt),
      },
    })),
  };
}
