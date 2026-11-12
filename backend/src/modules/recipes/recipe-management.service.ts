import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { findDietViolations, normalizeDietTags } from "../../services/dietary.service.js";
import { deleteImageQuietly, IMAGE_FOLDERS, uploadImage } from "../../services/image-upload.service.js";
import { searchRecipes } from "../../services/recipe-search.js";
import { HttpError } from "../../utils/http-error.js";
import { nextAvailableSlug, slugifyVietnamese } from "../../utils/slug.js";
import { recordAdminAction } from "../admin/admin-audit.service.js";
import type { AdminRecipeListQuery, CreateRecipeInput, RecipeInput } from "../admin/admin-recipes.schema.js";
import { linkPromotedPost } from "../community/community-post-edit.service.js";

// Quản lý công thức (Admin): tạo/sửa/ẩn/xóa. Món đã được dùng (thực đơn hoặc bài viết) chỉ ẩn, không xóa hẳn.
// Mỗi thao tác ghi nhật ký Admin trong cùng transaction (actorId là Admin lấy từ JWT).

const usageCount = { _count: { select: { mealItems: true, communityPosts: true } } } as const;
const NOT_FOUND = "Không tìm thấy công thức.";

type RecipeWithUsage = { hiddenAt: Date | null; _count: { mealItems: number; communityPosts: number } };

type PreparedRecipe = ReturnType<typeof prepareRecipeData>;
type StoredRecipe = Prisma.RecipeGetPayload<{ include: { ingredients: true } }>;

const sortedJson = (values: string[]) => JSON.stringify([...values].sort());
const ingredientsJson = (items: { name: string; quantity: number; unit: string; optional?: boolean }[]) =>
  JSON.stringify(items.map(({ name, quantity, unit, optional }) => [name, quantity, unit, optional ?? false]));

/** Tên các trường bị đổi khi sửa món (chỉ tên trường, không lưu giá trị vào nhật ký). */
function changedRecipeFields(current: StoredRecipe, { data, ingredients }: PreparedRecipe) {
  const fields = Object.keys(data) as (keyof PreparedRecipe["data"])[];
  const changed: string[] = fields.filter((field) => {
    const [before, after] = [current[field], data[field]];
    if (field === "dietTags" || field === "mealTypes") return sortedJson(before as string[]) !== sortedJson(after as string[]);
    return JSON.stringify(before ?? null) !== JSON.stringify(after ?? null);
  });
  if (ingredientsJson(current.ingredients) !== ingredientsJson(ingredients)) changed.push("ingredients");
  return changed;
}

function withUsage<T extends RecipeWithUsage>({ _count, ...recipe }: T) {
  return { ...recipe, hidden: recipe.hiddenAt !== null, usage: { mealPlanItems: _count.mealItems, posts: _count.communityPosts } };
}

/** Nhãn VEGAN kéo theo VEGETARIAN; nhãn chay sai với nguyên liệu → 422 kèm danh sách nguyên liệu vi phạm. */
function prepareRecipeData(input: RecipeInput) {
  const dietTags = normalizeDietTags(input.dietTags);
  const violations = findDietViolations({ dietTags, ingredients: input.ingredients });
  if (violations.length) {
    throw new HttpError(422, "Nhãn chay/thuần chay không khớp với nguyên liệu.", { violations });
  }
  const { ingredients, mealTypes, imageUrl, ...fields } = input;
  return {
    data: { ...fields, dietTags, mealTypes: [...new Set(mealTypes)], imageUrl: imageUrl ?? null },
    ingredients,
  };
}

const adminListSelect = {
  id: true, slug: true, name: true, imageUrl: true, calories: true, cuisine: true, dietTags: true, mealTypes: true,
  hiddenAt: true, deletedAt: true, createdAt: true, updatedAt: true, ...usageCount,
} as const;

const adminStatusWhere = (status: AdminRecipeListQuery["status"]): Prisma.RecipeWhereInput => {
  if (status === "deleted") return { deletedAt: { not: null } };
  if (status === "visible") return { deletedAt: null, hiddenAt: null };
  if (status === "hidden") return { deletedAt: null, hiddenAt: { not: null } };
  return { deletedAt: null };
};

/** "Tất cả" = mọi món chưa xóa mềm; "Đã xóa" chỉ món xóa mềm (để khôi phục). Từ khóa dùng chung searchRecipes với ô tìm của người dùng. */
export async function listRecipesForAdmin(query: AdminRecipeListQuery) {
  const where = adminStatusWhere(query.status);
  const skip = (query.page - 1) * query.pageSize;
  if (query.search) {
    // shortcut: lọc ở ứng dụng trên toàn bộ món (thư viện vài chục món); khi lên hàng nghìn món thì chuyển sang tìm bằng SQL.
    const rows = await prisma.recipe.findMany({
      where, orderBy: { name: "asc" }, select: { ...adminListSelect, ingredients: { select: { name: true } } },
    });
    const matched = searchRecipes(rows, query.search);
    const items = matched.slice(skip, skip + query.pageSize).map(({ ingredients: _ingredients, ...recipe }) => withUsage(recipe));
    return { items, total: matched.length, page: query.page, pageSize: query.pageSize };
  }
  const [total, recipes] = await Promise.all([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({ where, orderBy: { name: "asc" }, skip, take: query.pageSize, select: adminListSelect }),
  ]);
  return { items: recipes.map(withUsage), total, page: query.page, pageSize: query.pageSize };
}

export async function getRecipeForAdmin(id: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true, ...usageCount } });
  if (recipe?.deletedAt) throw new HttpError(404, NOT_FOUND);
  if (!recipe) throw new HttpError(404, NOT_FOUND);
  return withUsage(recipe);
}

/**
 * Slug sinh từ tên tiếng Việt, thêm hậu tố nếu trùng. Hai yêu cầu tạo cùng lúc trùng slug → 409, gửi lại là được.
 * sourcePostId ("Chuyển thành công thức"): gắn bài cộng đồng với món mới + nhật ký trong cùng transaction.
 */
export async function createRecipe(actorId: string, { sourcePostId, ...input }: CreateRecipeInput) {
  const { data, ingredients } = prepareRecipeData(input);
  const base = slugifyVietnamese(data.name);
  const taken = await prisma.recipe.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  try {
    return await prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: { ...data, slug: nextAvailableSlug(base, taken.map((item) => item.slug)), ingredients: { create: ingredients } },
        include: { ingredients: true },
      });
      await recordAdminAction(tx, {
        actorId, action: "RECIPE_CREATE", targetType: "RECIPE", targetId: recipe.id, targetLabel: recipe.name, details: { slug: recipe.slug },
      });
      if (sourcePostId) await linkPromotedPost(tx, actorId, sourcePostId, recipe);
      return recipe;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new HttpError(409, "Công thức trùng đường dẫn với món vừa tạo, vui lòng thử lại.");
    }
    throw error;
  }
}

/**
 * Sửa toàn bộ món; nguyên liệu thay mới bằng nested write, cùng transaction với nhật ký Admin.
 * Slug giữ nguyên khi đổi tên để seed vẫn nhận ra món gốc. Thực đơn cũ giữ calo đã lưu ở MealPlanItem.
 */
export async function updateRecipe(actorId: string, id: string, input: RecipeInput) {
  const prepared = prepareRecipeData(input);
  const { data, ingredients } = prepared;
  const current = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true } });
  if (!current || current.deletedAt) throw new HttpError(404, NOT_FOUND);
  // Đổi sang ảnh khác (vd. về ảnh nhóm món) thì bỏ liên kết ảnh Cloudinary cũ và xóa nó sau khi lưu xong.
  const replacesUploadedImage = Boolean(current.imagePublicId) && data.imageUrl !== current.imageUrl;
  const updated = await prisma.$transaction(async (tx) => {
    const recipe = await tx.recipe.update({
      where: { id },
      data: { ...data, ...(replacesUploadedImage ? { imagePublicId: null } : {}), ingredients: { deleteMany: {}, create: ingredients } },
      include: { ingredients: true },
    });
    await recordAdminAction(tx, {
      actorId, action: "RECIPE_UPDATE", targetType: "RECIPE", targetId: id, targetLabel: recipe.name,
      details: { changedFields: changedRecipeFields(current, prepared) },
    });
    return recipe;
  });
  if (replacesUploadedImage) await deleteImageQuietly(current.imagePublicId);
  return updated;
}

/**
 * Thay ảnh món bằng ảnh vừa tải lên (thư mục nouri/recipes). Lưu DB lỗi thì xóa ảnh vừa tải để không để ảnh mồ côi;
 * lưu xong mới xóa ảnh cũ (lỗi chỉ ghi log).
 */
export async function replaceRecipeImage(actorId: string, id: string, file: Buffer) {
  const current = await prisma.recipe.findUnique({ where: { id }, select: { id: true, name: true, imagePublicId: true, deletedAt: true } });
  if (!current || current.deletedAt) throw new HttpError(404, NOT_FOUND);
  const uploaded = await uploadImage(file, IMAGE_FOLDERS.recipes);
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.update({
        where: { id },
        data: { imageUrl: uploaded.url, imagePublicId: uploaded.publicId },
        select: { id: true, imageUrl: true, imagePublicId: true },
      });
      await recordAdminAction(tx, {
        actorId, action: "RECIPE_IMAGE_REPLACE", targetType: "RECIPE", targetId: id, targetLabel: current.name,
        details: { replacedUploadedImage: Boolean(current.imagePublicId) },
      });
      return recipe;
    });
  } catch (error) {
    await deleteImageQuietly(uploaded.publicId);
    throw error;
  }
  if (current.imagePublicId && current.imagePublicId !== uploaded.publicId) await deleteImageQuietly(current.imagePublicId);
  return updated;
}

/**
 * Ẩn (ngừng sử dụng) hoặc hiện lại; ẩn lại món đã ẩn thì giữ thời điểm ẩn ban đầu.
 * Chỉ ghi nhật ký khi trạng thái thực sự đổi (gửi lại cùng trạng thái không tạo dòng mới).
 */
export async function setRecipeVisibility(actorId: string, id: string, hidden: boolean) {
  const recipe = await prisma.recipe.findUnique({ where: { id }, select: { id: true, name: true, hiddenAt: true, deletedAt: true } });
  if (!recipe || recipe.deletedAt) throw new HttpError(404, NOT_FOUND);
  const hiddenAt = hidden ? recipe.hiddenAt ?? new Date() : null;
  const changed = (recipe.hiddenAt !== null) !== hidden;
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.recipe.update({ where: { id }, data: { hiddenAt }, select: { id: true, hiddenAt: true } });
    if (changed) {
      await recordAdminAction(tx, {
        actorId, action: hidden ? "RECIPE_HIDE" : "RECIPE_SHOW", targetType: "RECIPE", targetId: id, targetLabel: recipe.name,
      });
    }
    return result;
  });
  return { ...updated, hidden: updated.hiddenAt !== null };
}

/** Khôi phục món đã xóa mềm: quay lại danh sách như trước khi xóa (giữ trạng thái ẩn/hiện cũ); ghi RECIPE_RESTORE. */
export async function restoreRecipe(actorId: string, id: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id }, select: { id: true, name: true, slug: true, deletedAt: true } });
  if (!recipe?.deletedAt) throw new HttpError(404, "Không tìm thấy món đã xóa.");
  await prisma.$transaction([
    prisma.recipe.update({ where: { id }, data: { deletedAt: null } }),
    recordAdminAction(prisma, {
      actorId, action: "RECIPE_RESTORE", targetType: "RECIPE", targetId: id, targetLabel: recipe.name, details: { slug: recipe.slug },
    }),
  ]);
  return { id, restored: true };
}

/** Xóa mềm: món đã được tham chiếu (thực đơn, bài viết) — giữ dòng để dữ liệu cũ còn tên, ẩn khỏi mọi nơi chọn mới; giữ ảnh. */
async function softDeleteRecipe(actorId: string, recipe: { id: string; name: string; slug: string }, now: Date) {
  await prisma.$transaction([
    prisma.recipe.update({ where: { id: recipe.id }, data: { deletedAt: now } }),
    recordAdminAction(prisma, {
      actorId, action: "RECIPE_DELETE", targetType: "RECIPE", targetId: recipe.id, targetLabel: recipe.name, details: { slug: recipe.slug, soft: true },
    }),
  ]);
  return { id: recipe.id, mode: "soft" as const };
}

/**
 * Admin xóa món. Chưa được tham chiếu (thực đơn, bài viết) → xóa hẳn rồi dọn ảnh Cloudinary (lỗi chỉ ghi log); đã được tham chiếu →
 * xóa mềm (`deletedAt`). Nếu món vừa được dùng giữa lúc kiểm và lúc xóa (FK Restrict, P2003) thì chuyển sang xóa mềm.
 * Ghi nhật ký RECIPE_DELETE (details.soft) trong cùng transaction.
 */
export async function deleteRecipe(actorId: string, id: string, now = new Date()) {
  const recipe = await prisma.recipe.findUnique({
    where: { id }, select: { id: true, name: true, slug: true, imagePublicId: true, deletedAt: true, ...usageCount },
  });
  if (!recipe || recipe.deletedAt) throw new HttpError(404, NOT_FOUND);
  if (recipe._count.mealItems || recipe._count.communityPosts) return softDeleteRecipe(actorId, recipe, now);
  try {
    await prisma.$transaction([
      prisma.recipe.delete({ where: { id } }),
      recordAdminAction(prisma, {
        actorId, action: "RECIPE_DELETE", targetType: "RECIPE", targetId: id, targetLabel: recipe.name, details: { slug: recipe.slug, soft: false },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return softDeleteRecipe(actorId, recipe, now);
    throw error;
  }
  await deleteImageQuietly(recipe.imagePublicId);
  return { id, mode: "hard" as const };
}
