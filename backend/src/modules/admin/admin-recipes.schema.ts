import { z } from "zod";
import { RECIPE_LIMITS as R } from "../../shared/limits.js";
import { normalizeFoodText } from "../../services/dietary.service.js";
import { isProjectImageUrl } from "../../services/image-upload.service.js";

const empty = z.object({});
const idParams = z.object({ id: z.string().cuid() });

const ingredientSchema = z.object({
  // Giống quy tắc dữ liệu seed: "Bơ" trống là nhập nhằng (dùng "Quả bơ" hoặc "Bơ lạt").
  name: z.string().trim().min(R.ingredientName[0]).max(R.ingredientName[1]).refine((name) => normalizeFoodText(name) !== "bơ", "Ghi rõ \"Quả bơ\" hoặc \"Bơ lạt\"."),
  quantity: z.number().positive().max(R.ingredientQuantityMax),
  unit: z.enum(["G", "KG", "ML", "L", "ITEM", "PACKAGE"]),
  optional: z.boolean().default(false),
});

const nutrient = z.number().min(R.nutrient[0]).max(R.nutrient[1]);

// Ảnh: chỉ ảnh nhóm món có sẵn (/assets/...) hoặc ảnh Cloudinary của dự án; tải ảnh mới dùng PUT /:id/image.
const imageUrlSchema = z.string().trim().max(500).refine(isProjectImageUrl, "Ảnh phải là ảnh có sẵn (/assets) hoặc ảnh đã tải lên của Nouri.");

export const recipeInputSchema = z.object({
  name: z.string().trim().min(R.name[0]).max(R.name[1]),
  description: z.string().trim().min(R.description[0]).max(R.description[1]),
  instructions: z.array(z.string().trim().min(R.step[0]).max(R.step[1])).min(R.steps[0]).max(R.steps[1]),
  prepMinutes: z.number().int().min(R.prepMinutes[0]).max(R.prepMinutes[1]),
  cookMinutes: z.number().int().min(R.cookMinutes[0]).max(R.cookMinutes[1]),
  servings: z.number().int().min(R.servings[0]).max(R.servings[1]).default(1),
  calories: z.number().int().min(R.calories[0]).max(R.calories[1]),
  proteinG: nutrient,
  carbsG: nutrient,
  fatG: nutrient,
  fiberG: nutrient.default(0),
  cuisine: z.string().trim().min(R.cuisine[0]).max(R.cuisine[1]),
  dietTags: z.array(z.enum(["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"])).min(1).max(5),
  mealTypes: z.array(z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"])).min(1).max(4),
  imageUrl: imageUrlSchema.nullable().optional(),
  ingredients: z.array(ingredientSchema).min(R.ingredients[0]).max(R.ingredients[1]),
});

export const listAdminRecipesSchema = z.object({
  body: empty,
  params: empty,
  query: z.object({
    search: z.string().trim().max(80).optional(),
    status: z.enum(["all", "visible", "hidden", "deleted"]).default("all"),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const adminRecipeIdSchema = z.object({ body: empty, params: idParams, query: empty });
// sourcePostId: "Chuyển thành công thức" từ công thức tự viết của một bài cộng đồng (gắn bài với món mới, ghi nhật ký).
export const createAdminRecipeSchema = z.object({
  body: recipeInputSchema.extend({ sourcePostId: z.string().cuid().optional() }),
  params: empty,
  query: empty,
});
export const updateAdminRecipeSchema = z.object({ body: recipeInputSchema, params: idParams, query: empty });
export const setRecipeVisibilitySchema = z.object({ body: z.object({ hidden: z.boolean() }), params: idParams, query: empty });

export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type CreateRecipeInput = z.infer<typeof createAdminRecipeSchema>["body"];
export type AdminRecipeListQuery = z.infer<typeof listAdminRecipesSchema>["query"];
export type AdminRecipeIdParams = z.infer<typeof idParams>;
