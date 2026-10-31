import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { findDietViolations, normalizeDietTags } from "../../services/dietary.service.js";
import { deleteImageQuietly, IMAGE_FOLDERS, uploadImage } from "../../services/image-upload.service.js";
import { HttpError } from "../../utils/http-error.js";
import { nextAvailableSlug, slugifyVietnamese } from "../../utils/slug.js";
import { recordAdminAction } from "../admin/admin-audit.service.js";
import type { AdminRecipeListQuery, RecipeInput } from "../admin/admin-recipes.schema.js";

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

export async function listRecipesForAdmin(query: AdminRecipeListQuery) {
  const where: Prisma.RecipeWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.status === "visible" ? { hiddenAt: null } : query.status === "hidden" ? { hiddenAt: { not: null } } : {}),
  };
  const [total, recipes] = await Promise.all([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true, slug: true, name: true, imageUrl: true, calories: true, cuisine: true, dietTags: true, mealTypes: true,
        hiddenAt: true, createdAt: true, updatedAt: true, ...usageCount,
      },
    }),
  ]);
  return { items: recipes.map(withUsage), total, page: query.page, pageSize: query.pageSize };
}

export async function getRecipeForAdmin(id: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true, ...usageCount } });
  if (!recipe) throw new HttpError(404, NOT_FOUND);
  return withUsage(recipe);
}

/** Slug sinh từ tên tiếng Việt, thêm hậu tố nếu trùng. Hai yêu cầu tạo cùng lúc trùng slug → 409, gửi lại là được. */
export async function createRecipe(actorId: string, input: RecipeInput) {
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
  if (!current) throw new HttpError(404, NOT_FOUND);
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
  const current = await prisma.recipe.findUnique({ where: { id }, select: { id: true, name: true, imagePublicId: true } });
  if (!current) throw new HttpError(404, NOT_FOUND);
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
  const recipe = await prisma.recipe.findUnique({ where: { id }, select: { id: true, name: true, hiddenAt: true } });
  if (!recipe) throw new HttpError(404, NOT_FOUND);
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

function usedRecipeError(usage: { mealPlanItems: number; posts: number }) {
  return new HttpError(
    409,
    "Món đã được dùng trong thực đơn hoặc bài viết nên không xóa được. Hãy ẩn món (ngừng sử dụng) thay vì xóa.",
    { usage },
  );
}

/**
 * Chỉ xóa hẳn món chưa từng được dùng; FK Restrict là lớp chặn cuối nếu món vừa được dùng giữa chừng.
 * Xóa xong mới dọn ảnh Cloudinary của món (nếu có), lỗi chỉ ghi log.
 */
export async function deleteRecipe(actorId: string, id: string) {
  const recipe = await prisma.recipe.findUnique({
    where: { id }, select: { id: true, name: true, slug: true, imagePublicId: true, ...usageCount },
  });
  if (!recipe) throw new HttpError(404, NOT_FOUND);
  const usage = { mealPlanItems: recipe._count.mealItems, posts: recipe._count.communityPosts };
  if (usage.mealPlanItems || usage.posts) throw usedRecipeError(usage);
  try {
    await prisma.$transaction([
      prisma.recipe.delete({ where: { id } }),
      recordAdminAction(prisma, {
        actorId, action: "RECIPE_DELETE", targetType: "RECIPE", targetId: id, targetLabel: recipe.name, details: { slug: recipe.slug },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw usedRecipeError(usage);
    throw error;
  }
  await deleteImageQuietly(recipe.imagePublicId);
}
