import { prisma } from "../../lib/prisma.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";
import { HttpError } from "../../utils/http-error.js";
import { vietnamToday } from "../../utils/vietnam-date.js";
import { buildCollaborativeModel, type CollaborativeModel } from "./collaborative.js";
import { type EngineData, type EngineQuery, runRecommendation } from "./hybrid.js";
import { loadCollaborativeInteractions, loadUserInteractions } from "./interactions.js";
import type { RecommendationsQuery } from "./recommendation.schema.js";

// Nạp dữ liệu cho bộ gợi ý (GĐ3b-R). Mọi dữ liệu cá nhân (hồ sơ, kho, lịch sử, thực đơn hôm nay) lọc theo userId từ JWT;
// thuật toán 2 chỉ dùng mô hình tổng hợp của mọi người (không trả dữ liệu của ai ra ngoài).

export const COLLABORATIVE_CACHE_MS = 10 * 60_000;
let collaborative: { builtAt: number; model: Promise<CollaborativeModel> } | null = null;

/**
 * Mô hình cộng tác (ma trận r_ui + k hàng xóm của mỗi món) dùng chung cho mọi người dùng, cache 10 phút: tương tác mới
 * (ăn, đăng bài, thích) có hiệu lực ở lần tính lại tiếp theo. Các request đến cùng lúc dùng chung một lần tính.
 */
export function getCollaborativeModel(now = new Date()) {
  if (!collaborative || now.getTime() - collaborative.builtAt >= COLLABORATIVE_CACHE_MS) {
    const model = loadCollaborativeInteractions().then((interactions) => buildCollaborativeModel(interactions, now));
    collaborative = { builtAt: now.getTime(), model };
    model.catch(() => { collaborative = null; });
  }
  return collaborative.model;
}

export function clearRecommendationCache() {
  collaborative = null;
}

/** Calo, đạm và số bữa đã ăn hôm nay (giờ Việt Nam) trong thực đơn đang áp dụng. */
export async function eatenToday(userId: string, now = new Date()) {
  const items = await prisma.mealPlanItem.findMany({
    where: { completed: true, day: { date: vietnamToday(now), mealPlan: { userId, status: "ACTIVE" } } },
    select: { calories: true, servings: true, recipe: { select: { proteinG: true } } },
  });
  return {
    calories: items.reduce((sum, item) => sum + item.calories, 0),
    proteinG: items.reduce((sum, item) => sum + item.recipe.proteinG * item.servings, 0),
    meals: items.length,
  };
}

export const engineRecipeQuery = { where: visibleRecipeWhere, include: { ingredients: true }, orderBy: { createdAt: "asc" as const } };

/** Gợi ý với dữ liệu người dùng đã nạp sẵn (Dashboard nạp hồ sơ, kho, món trước đó): chỉ nạp thêm lịch sử và mô hình cộng tác. */
export async function recommendWithData(
  data: Omit<EngineData, "interactions" | "model" | "today"> & Partial<Pick<EngineData, "today">>, query: EngineQuery,
) {
  const [interactions, model, today] = await Promise.all([
    loadUserInteractions(data.userId),
    getCollaborativeModel(data.now),
    data.today ?? eatenToday(data.userId, data.now),
  ]);
  return runRecommendation({ ...data, interactions, model, today }, query);
}

/** GET /api/recommendations. Món/thực phẩm không tồn tại hoặc thực phẩm không thuộc người dùng → 404. */
export async function getRecommendations(userId: string, query: RecommendationsQuery, now = new Date()) {
  const [recipes, profile, pantry, focusItem, base] = await Promise.all([
    prisma.recipe.findMany(engineRecipeQuery),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
    query.pantryItemId ? prisma.pantryItem.findFirst({ where: { id: query.pantryItemId, userId } }) : null,
    query.recipeId ? prisma.recipe.findUnique({ where: { id: query.recipeId }, select: { id: true } }) : null,
  ]);
  if (query.pantryItemId && !focusItem) throw new HttpError(404, "Không tìm thấy thực phẩm.");
  if (query.recipeId && !base) throw new HttpError(404, "Không tìm thấy công thức.");
  return recommendWithData({ userId, recipes, profile, pantry, now }, {
    context: query.context, limit: query.limit, mealType: query.mealType, recipeId: query.recipeId, focusItem: focusItem ?? undefined,
  });
}
