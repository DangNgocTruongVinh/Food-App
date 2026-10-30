import { prisma } from "../../lib/prisma.js";
import { buildWeeklySeries, statsRangeStart } from "./admin-stats.logic.js";

/**
 * Tổng số và số mới theo 12 tuần gần nhất (giờ Việt Nam, tuần bắt đầu thứ Hai). Theo tuần: đọc createdAt trong
 * khoảng 12 tuần rồi gom ở ứng dụng (đủ cho quy mô đồ án; dữ liệu lớn thì chuyển sang GROUP BY trong SQL).
 */
export async function getAdminStats(now = new Date()) {
  const since = { createdAt: { gte: statsRangeStart(now) } };
  const createdAtOnly = { select: { createdAt: true } } as const;
  const [users, lockedUsers, mealPlans, posts, recipes, hiddenRecipes, newUsers, newMealPlans, newPosts] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { lockedAt: { not: null } } }),
    prisma.mealPlan.count(),
    prisma.communityPost.count(),
    prisma.recipe.count(),
    prisma.recipe.count({ where: { hiddenAt: { not: null } } }),
    prisma.user.findMany({ where: since, ...createdAtOnly }),
    prisma.mealPlan.findMany({ where: since, ...createdAtOnly }),
    prisma.communityPost.findMany({ where: since, ...createdAtOnly }),
  ]);
  const dates = (rows: Array<{ createdAt: Date }>) => rows.map((row) => row.createdAt);
  return {
    totals: { users, lockedUsers, mealPlans, posts, recipes, hiddenRecipes },
    weekly: buildWeeklySeries(now, { users: dates(newUsers), mealPlans: dates(newMealPlans), posts: dates(newPosts) }),
    timeZone: "Asia/Ho_Chi_Minh",
  };
}
