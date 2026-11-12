import { prisma } from "../../lib/prisma.js";
import { buildWeeklySeries, statsRangeStart } from "./admin-stats.logic.js";

/**
 * Tổng số và số mới theo 12 tuần gần nhất (giờ Việt Nam, tuần bắt đầu thứ Hai). Theo tuần: đọc createdAt trong
 * khoảng 12 tuần rồi gom ở ứng dụng (đủ cho quy mô đồ án; dữ liệu lớn thì chuyển sang GROUP BY trong SQL).
 */
export async function getAdminStats(now = new Date()) {
  // Tài khoản mẫu minh họa (User.isSample) và thực đơn/bài viết của họ không tính vào thống kê.
  const realUser = { isSample: false };
  const ownedByRealUser = { user: realUser };
  const since = { createdAt: { gte: statsRangeStart(now) } };
  const createdAtOnly = { select: { createdAt: true } } as const;
  const [users, lockedUsers, mealPlans, posts, recipes, hiddenRecipes, newUsers, newMealPlans, newPosts] = await Promise.all([
    prisma.user.count({ where: realUser }),
    prisma.user.count({ where: { ...realUser, lockedAt: { not: null } } }),
    prisma.mealPlan.count({ where: ownedByRealUser }),
    prisma.communityPost.count({ where: { author: realUser } }),
    prisma.recipe.count({ where: { deletedAt: null } }),
    prisma.recipe.count({ where: { hiddenAt: { not: null }, deletedAt: null } }),
    prisma.user.findMany({ where: { ...since, ...realUser }, ...createdAtOnly }),
    prisma.mealPlan.findMany({ where: { ...since, ...ownedByRealUser }, ...createdAtOnly }),
    prisma.communityPost.findMany({ where: { ...since, author: realUser }, ...createdAtOnly }),
  ]);
  const dates = (rows: Array<{ createdAt: Date }>) => rows.map((row) => row.createdAt);
  return {
    totals: { users, lockedUsers, mealPlans, posts, recipes, hiddenRecipes },
    weekly: buildWeeklySeries(now, { users: dates(newUsers), mealPlans: dates(newMealPlans), posts: dates(newPosts) }),
    timeZone: "Asia/Ho_Chi_Minh",
  };
}
