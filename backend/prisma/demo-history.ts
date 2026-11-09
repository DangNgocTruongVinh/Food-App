import type { MealType, Prisma } from "@prisma/client";
import { vietnamToday } from "../src/utils/vietnam-date.js";

// Lịch sử mẫu của tài khoản demo (dữ liệu mẫu, không phải hoạt động thật): khoảng 2 tuần trước ngày chạy (giờ Việt Nam), để bộ
// gợi ý không rơi vào "khởi đầu lạnh" khi demo. Khẩu vị nhất quán: món Việt, thích món cá, thêm vài món Nhật (khớp hồ sơ demo:
// ẩm thực Việt Nam, Nhật Bản; không món nào có "Cần tây" — món demo không thích). Bữa "đã ăn" theo kiểu "chỉ đánh dấu, không trừ
// kho" nên không có lịch sử kho. Thích 2–3 bài của tài khoản mẫu minh họa có món cùng khẩu vị.

const DAY_MS = 86_400_000;

/** Bữa đã ăn: món (slug), ngày so với hôm nay, bữa. */
export const DEMO_HISTORY_MEALS: Array<{ slug: string; day: number; mealType: MealType }> = [
  { slug: "chao-ga-hanh-gung", day: -13, mealType: "BREAKFAST" },
  { slug: "ca-kho-to", day: -13, mealType: "DINNER" },
  { slug: "canh-chua-ca-loc", day: -12, mealType: "LUNCH" },
  { slug: "pho-bo", day: -11, mealType: "BREAKFAST" },
  { slug: "ca-hap-gung-hanh", day: -11, mealType: "DINNER" },
  { slug: "bun-cha-ha-noi", day: -10, mealType: "LUNCH" },
  { slug: "bun-bo-nam-bo", day: -9, mealType: "LUNCH" },
  { slug: "ga-teriyaki", day: -9, mealType: "DINNER" },
  { slug: "com-tam-suon-nuong", day: -8, mealType: "LUNCH" },
  { slug: "canh-bi-do-tom", day: -8, mealType: "DINNER" },
  { slug: "goi-cuon-tom-thit", day: -7, mealType: "LUNCH" },
  { slug: "ca-kho-to", day: -7, mealType: "DINNER" },
];
/** Món của bài viết mẫu mà demo thích (theo thứ tự ưu tiên), và ngày thích so với hôm nay. */
export const DEMO_LIKED_RECIPES = ["ca-hap-gung-hanh", "ga-teriyaki", "ga-xao-sa-ot", "bo-xao-bong-cai", "chao-ga-hanh-gung"];
const LIKE_DAYS = [-12, -9, -5];

type HistoryClient = Pick<Prisma.TransactionClient, "recipe" | "mealPlan" | "communityPost" | "communityLike">;

/**
 * Tạo lịch sử mẫu cho demo: một thực đơn đã qua (COMPLETED, 7 ngày, 12 bữa đã ăn, 11 món khác nhau) và lượt thích bài của tài khoản mẫu.
 * Gọi sau khi đã xóa dữ liệu cũ của demo và tạo lại tài khoản mẫu. Món không còn hoặc đã ẩn thì bỏ qua.
 */
export async function createDemoHistory(client: HistoryClient, userId: string, now = new Date()) {
  const today = vietnamToday(now);
  const date = (day: number) => new Date(today.getTime() + day * DAY_MS);
  const slugs = [...new Set(DEMO_HISTORY_MEALS.map((meal) => meal.slug))];
  const recipes = await client.recipe.findMany({ where: { slug: { in: slugs }, hiddenAt: null }, select: { id: true, slug: true, calories: true } });
  const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));
  const meals = DEMO_HISTORY_MEALS.filter((meal) => bySlug.has(meal.slug));
  const start = Math.min(...DEMO_HISTORY_MEALS.map((meal) => meal.day));
  await client.mealPlan.create({
    data: {
      userId, name: "Thực đơn mẫu (2 tuần trước)", status: "COMPLETED", aiGenerated: false, calorieTarget: 1800,
      startDate: date(start), endDate: date(start + 6), summary: "Dữ liệu mẫu của tài khoản demo.",
      days: {
        create: Array.from({ length: 7 }, (_, index) => ({
          date: date(start + index),
          items: {
            create: meals.filter((meal) => meal.day === start + index).map((meal) => ({
              recipeId: bySlug.get(meal.slug)!.id, mealType: meal.mealType, servings: 1, completed: true, calories: bySlug.get(meal.slug)!.calories,
            })),
          },
        })),
      },
    },
  });
  const posts = await client.communityPost.findMany({
    where: { author: { isSample: true }, recipe: { slug: { in: DEMO_LIKED_RECIPES } } },
    select: { id: true, recipe: { select: { slug: true } } },
  });
  const ordered = posts.sort((a, b) => DEMO_LIKED_RECIPES.indexOf(a.recipe!.slug) - DEMO_LIKED_RECIPES.indexOf(b.recipe!.slug)).slice(0, LIKE_DAYS.length);
  if (ordered.length) {
    await client.communityLike.createMany({
      data: ordered.map((post, index) => ({ postId: post.id, userId, createdAt: new Date(date(LIKE_DAYS[index]).getTime() + 12 * 3_600_000) })),
    });
  }
  return { meals: meals.length, likes: ordered.length };
}
