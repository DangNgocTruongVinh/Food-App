import type { FoodUnit, MealType, Prisma } from "@prisma/client";
import { vietnamToday } from "../src/utils/vietnam-date.js";

// Dữ liệu mẫu cho trang Báo cáo của demo (không phải hoạt động thật): 8 tuần lịch sử kho với số món bỏ đi giảm dần và tỉ lệ dùng
// trước hạn tăng dần (xu hướng cải thiện), một nửa món bỏ đi có giá; và các bữa "Đã ăn" trong 6 ngày gần đây (bỏ trống 1 ngày để thấy
// "chưa ghi"). Dòng lịch sử ghi chú "Dữ liệu mẫu", không gắn thực phẩm nào trong kho hiện tại.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
export const DEMO_REPORT_NOTE = "Dữ liệu mẫu (báo cáo)";

type Food = { name: string; category: string; unit: FoodUnit; quantity: number; unitPrice: number | null };
const FOODS: Food[] = [
  { name: "Rau muống", category: "Rau củ", unit: "G", quantity: 300, unitPrice: 30 },
  { name: "Cải ngọt", category: "Rau củ", unit: "G", quantity: 250, unitPrice: null },
  { name: "Sữa tươi", category: "Trứng & sữa", unit: "ML", quantity: 500, unitPrice: 32 },
  { name: "Bánh mì", category: "Ngũ cốc", unit: "ITEM", quantity: 2, unitPrice: null },
  { name: "Chuối", category: "Trái cây", unit: "ITEM", quantity: 3, unitPrice: 4_000 },
  { name: "Đậu hũ", category: "Đậu & hạt", unit: "G", quantity: 300, unitPrice: null },
  { name: "Thịt heo xay", category: "Thịt & cá", unit: "G", quantity: 200, unitPrice: 130 },
];

/** Theo tuần, cũ → mới (tuần cuối là tuần hiện tại): số món bỏ đi, số lần dùng, số lần dùng trước hạn. */
export const DEMO_REPORT_WEEKS = [
  { discarded: 4, used: 3, onTime: 1 },
  { discarded: 4, used: 4, onTime: 2 },
  { discarded: 3, used: 4, onTime: 2 },
  { discarded: 3, used: 5, onTime: 3 },
  { discarded: 2, used: 5, onTime: 4 },
  { discarded: 2, used: 6, onTime: 5 },
  { discarded: 1, used: 6, onTime: 6 },
  { discarded: 1, used: 3, onTime: 3 },
];

/** Bữa "Đã ăn" mẫu: ngày so với hôm nay (ngày -3 cố ý bỏ trống → "chưa ghi"). */
export const DEMO_REPORT_MEALS: Array<{ slug: string; day: number; mealType: MealType }> = [
  { slug: "pho-bo", day: -6, mealType: "BREAKFAST" }, { slug: "com-tam-suon-nuong", day: -6, mealType: "LUNCH" },
  { slug: "canh-chua-ca-loc", day: -6, mealType: "DINNER" },
  { slug: "chao-ga-hanh-gung", day: -5, mealType: "BREAKFAST" }, { slug: "bun-cha-ha-noi", day: -5, mealType: "LUNCH" },
  { slug: "ca-hap-gung-hanh", day: -4, mealType: "LUNCH" }, { slug: "ga-teriyaki", day: -4, mealType: "DINNER" },
  { slug: "pho-bo", day: -2, mealType: "BREAKFAST" }, { slug: "bun-bo-nam-bo", day: -2, mealType: "LUNCH" },
  { slug: "ca-kho-to", day: -2, mealType: "DINNER" },
  { slug: "chao-ga-hanh-gung", day: -1, mealType: "BREAKFAST" }, { slug: "goi-cuon-tom-thit", day: -1, mealType: "LUNCH" },
];

type ReportClient = Pick<Prisma.TransactionClient, "pantryTransaction" | "recipe" | "mealPlan">;

/** Dòng lịch sử kho mẫu: tuần `weeksAgo` (0 = tuần này), lùi vài giờ trước thời điểm chạy để không rơi vào tương lai. */
export function demoReportTransactions(userId: string, now: Date): Prisma.PantryTransactionCreateManyInput[] {
  const rows: Prisma.PantryTransactionCreateManyInput[] = [];
  DEMO_REPORT_WEEKS.forEach((week, index) => {
    const weeksAgo = DEMO_REPORT_WEEKS.length - 1 - index;
    const base = now.getTime() - weeksAgo * 7 * DAY_MS;
    const at = (slot: number) => new Date(base - (slot + 1) * 2 * HOUR_MS);
    let slot = 0;
    for (let n = 0; n < week.discarded; n += 1) {
      const food = FOODS[(index + n) % FOODS.length];
      const createdAt = at(slot++);
      rows.push({
        userId, itemName: food.name, unit: food.unit, delta: -food.quantity, quantityAfter: 0, source: "MANUAL_DELETE",
        removalReason: "DISCARDED", category: food.category, unitPrice: food.unitPrice, note: DEMO_REPORT_NOTE, createdAt,
        expiryDate: new Date(vietnamToday(createdAt).getTime() - DAY_MS), // bỏ đi khi đã quá hạn 1 ngày
      });
    }
    for (let n = 0; n < week.used; n += 1) {
      const food = FOODS[(index + n + 3) % FOODS.length];
      const createdAt = at(slot++);
      const onTime = n < week.onTime;
      rows.push({
        userId, itemName: food.name, unit: food.unit, delta: -food.quantity / 2, quantityAfter: food.quantity / 2, source: "CONSUMPTION",
        category: food.category, unitPrice: food.unitPrice, note: DEMO_REPORT_NOTE, createdAt,
        expiryDate: new Date(vietnamToday(createdAt).getTime() + (onTime ? 2 : -1) * DAY_MS),
      });
    }
  });
  return rows;
}

/** Tạo lịch sử kho mẫu và một thực đơn đã qua có các bữa "Đã ăn" trong 6 ngày gần đây. Món không còn hoặc đã ẩn thì bỏ qua. */
export async function createDemoReportHistory(client: ReportClient, userId: string, now = new Date()) {
  const transactions = await client.pantryTransaction.createMany({ data: demoReportTransactions(userId, now) });
  const today = vietnamToday(now);
  const date = (day: number) => new Date(today.getTime() + day * DAY_MS);
  const slugs = [...new Set(DEMO_REPORT_MEALS.map((meal) => meal.slug))];
  const recipes = await client.recipe.findMany({ where: { slug: { in: slugs }, hiddenAt: null }, select: { id: true, slug: true, calories: true } });
  const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));
  const meals = DEMO_REPORT_MEALS.filter((meal) => bySlug.has(meal.slug));
  await client.mealPlan.create({
    data: {
      userId, name: "Thực đơn mẫu (6 ngày qua)", status: "COMPLETED", aiGenerated: false, calorieTarget: 1800,
      startDate: date(-6), endDate: date(-1), summary: "Dữ liệu mẫu của tài khoản demo (cho trang Báo cáo).",
      days: {
        create: Array.from({ length: 6 }, (_, index) => ({
          date: date(index - 6),
          items: {
            create: meals.filter((meal) => meal.day === index - 6).map((meal) => ({
              recipeId: bySlug.get(meal.slug)!.id, mealType: meal.mealType, servings: 1, completed: true, calories: bySlug.get(meal.slug)!.calories,
            })),
          },
        })),
      },
    },
  });
  return { transactions: transactions.count, meals: meals.length };
}
