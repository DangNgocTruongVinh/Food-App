import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { calorieShare, matchRecipeToPantry, recipeWarnings } from "../../services/recipe-fit.service.js";
import { HIDDEN_RECIPE_MESSAGE, isRecipeHidden, visibleRecipeWhere } from "../../services/recipe-visibility.js";
import { HttpError } from "../../utils/http-error.js";
import { recipeFit } from "../recommendation/safety.js";
import { featuredRecipeSelect, pickFeaturedRecipes } from "./featured-recipes.js";
import type { RecipeListQuery } from "./recipes.schema.js";

const recipeWithIngredients = { ingredients: true } as const;

/** Id các món người dùng đã yêu thích (UC24). */
async function favoriteRecipeIds(userId: string) {
  const rows = await prisma.favoriteRecipe.findMany({ where: { userId }, select: { recipeId: true } });
  return new Set(rows.map((row) => row.recipeId));
}

/** GET /api/recipes/favorites: món yêu thích của chính người dùng (mới thêm trước), bỏ món đã ngừng sử dụng; kèm `fit` như danh sách. */
export async function listFavoriteRecipes(userId: string) {
  const [favorites, profile] = await Promise.all([
    prisma.favoriteRecipe.findMany({
      where: { userId, recipe: visibleRecipeWhere }, orderBy: { createdAt: "desc" }, select: { recipe: { include: recipeWithIngredients } },
    }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
  ]);
  return favorites.map(({ recipe }) => ({ ...recipe, fit: recipeFit(recipe, profile), favorite: true }));
}

/**
 * PUT/DELETE /api/recipes/:id/favorite: bật/tắt yêu thích (gọi lại nhiều lần vẫn cùng kết quả). Bật cho món không có → 404,
 * món đã ngừng sử dụng → 422; tắt luôn được.
 */
export async function setRecipeFavorite(userId: string, recipeId: string, favorite: boolean) {
  if (!favorite) {
    await prisma.favoriteRecipe.deleteMany({ where: { userId, recipeId } });
    return { recipeId, favorite: false };
  }
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, select: { id: true, hiddenAt: true, deletedAt: true } });
  if (!recipe) throw new HttpError(404, "Không tìm thấy công thức.");
  if (isRecipeHidden(recipe)) throw new HttpError(422, HIDDEN_RECIPE_MESSAGE);
  await prisma.favoriteRecipe.createMany({ data: [{ userId, recipeId }], skipDuplicates: true });
  return { recipeId, favorite: true };
}

/**
 * Số công thức theo nhóm cho Landing (công khai, Guest xem được): chỉ trả số đếm, không trả dữ liệu công thức.
 * Nhóm khớp với nhãn thật của công thức: bữa ăn (mealTypes) và chế độ ăn (dietTags).
 */
export async function getRecipeStats() {
  const [total, breakfast, vegetarian, vegan, lowCarb, highProtein] = await Promise.all([
    prisma.recipe.count({ where: visibleRecipeWhere }),
    prisma.recipe.count({ where: { ...visibleRecipeWhere, mealTypes: { has: "BREAKFAST" } } }),
    prisma.recipe.count({ where: { ...visibleRecipeWhere, dietTags: { hasSome: ["VEGETARIAN", "VEGAN"] } } }),
    prisma.recipe.count({ where: { ...visibleRecipeWhere, dietTags: { has: "VEGAN" } } }),
    prisma.recipe.count({ where: { ...visibleRecipeWhere, dietTags: { has: "LOW_CARB" } } }),
    prisma.recipe.count({ where: { ...visibleRecipeWhere, dietTags: { has: "HIGH_PROTEIN" } } }),
  ]);
  return { total, breakfast, vegetarian, vegan, lowCarb, highProtein };
}

/**
 * Món tiêu biểu cho Landing (công khai): chỉ món đang hiện, chỉ trường tóm tắt, ưu tiên món có ảnh thật.
 * Bộ món nhỏ (vài chục món) nên lấy hết bản tóm tắt rồi chọn ở ứng dụng; bộ món lớn thì chuyển sang chọn bằng SQL.
 */
export async function getFeaturedRecipes(limit: number) {
  const rows = await prisma.recipe.findMany({ where: visibleRecipeWhere, select: featuredRecipeSelect });
  return pickFeaturedRecipes(rows, limit);
}

/**
 * Danh sách "Tất cả công thức" (không phải gợi ý nên không lọc theo hồ sơ): mỗi món kèm `fit` của người đang đăng nhập
 * (dị ứng, không thích, xung đột chay/thuần chay, `safe`) để giao diện ẩn mặc định hoặc gắn nhãn.
 */
export async function listRecipes(userId: string, query: RecipeListQuery) {
  const where: Prisma.RecipeWhereInput = {
    ...visibleRecipeWhere,
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.cuisine ? { cuisine: query.cuisine } : {}),
  };

  const [recipes, profile, favorites] = await Promise.all([
    prisma.recipe.findMany({ where, include: recipeWithIngredients, orderBy: { name: "asc" } }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    favoriteRecipeIds(userId),
  ]);
  return recipes.map((recipe) => ({ ...recipe, fit: recipeFit(recipe, profile), favorite: favorites.has(recipe.id) }));
}

export async function getRecipe(id: string, userId?: string) {
  const [recipe, favorite] = await Promise.all([
    prisma.recipe.findUnique({ where: { id }, include: recipeWithIngredients }),
    userId ? prisma.favoriteRecipe.findUnique({ where: { userId_recipeId: { userId, recipeId: id } }, select: { id: true } }) : null,
  ]);
  if (!recipe) throw new HttpError(404, "Không tìm thấy công thức.");
  // Món đã ẩn vẫn xem được qua link trực tiếp (thực đơn cũ, bài viết cũ); frontend hiện "Món này đã ngừng sử dụng".
  return { ...recipe, hidden: isRecipeHidden(recipe), deleted: Boolean(recipe.deletedAt), favorite: Boolean(favorite) };
}

/** Khối "Dành cho bạn" ở trang chi tiết công thức, tính cho người dùng đang đăng nhập (userId lấy từ JWT). */
export async function getRecipeForYou(userId: string, id: string, now = new Date()) {
  const [recipe, profile, pantry] = await Promise.all([
    prisma.recipe.findUnique({ where: { id }, include: recipeWithIngredients }),
    prisma.nutritionProfile.findUnique({ where: { userId } }),
    prisma.pantryItem.findMany({ where: { userId, quantity: { gt: 0 } } }),
  ]);
  if (!recipe) throw new HttpError(404, "Không tìm thấy công thức.");
  if (isRecipeHidden(recipe)) throw new HttpError(404, HIDDEN_RECIPE_MESSAGE);
  const pantryMatch = matchRecipeToPantry(recipe, pantry, now);
  return {
    recipeId: recipe.id,
    pantry: { ...pantryMatch, inPantryCount: pantryMatch.inPantry.length },
    calories: calorieShare(recipe.calories, profile),
    warnings: recipeWarnings(recipe, profile),
  };
}
