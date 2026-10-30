import { prisma } from "../../lib/prisma.js";
import { recommendRecipes } from "../../services/recipe-fit.service.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";

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
    prisma.recipe.findMany({ where: visibleRecipeWhere, orderBy: { createdAt: "asc" }, include: { ingredients: true } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
  ]);
  // Gợi ý theo hồ sơ (chế độ ăn, dị ứng, món không thích) và kho: ưu tiên nguyên liệu sắp hết hạn.
  const recommendedRecipes = recommendRecipes(recipes, profile, pantry, DASHBOARD_RECOMMENDATIONS, now)
    .map(({ recipe, totalIngredients, pantryIngredientCount, expiringIngredientCount }) => ({
      id: recipe.id,
      name: recipe.name,
      calories: recipe.calories,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      dietTags: recipe.dietTags,
      imageUrl: recipe.imageUrl,
      totalIngredients,
      pantryIngredientCount,
      expiringIngredientCount,
    }));

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
      },
    })),
  };
}
