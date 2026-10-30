import { z } from "zod";
import { normalizeFoodText } from "../../services/dietary.service.js";

const empty = z.object({});
const idParams = z.object({ id: z.string().cuid() });

const ingredientSchema = z.object({
  // Giống quy tắc dữ liệu seed: "Bơ" trống là nhập nhằng (dùng "Quả bơ" hoặc "Bơ lạt").
  name: z.string().trim().min(1).max(80).refine((name) => normalizeFoodText(name) !== "bơ", "Ghi rõ \"Quả bơ\" hoặc \"Bơ lạt\"."),
  quantity: z.number().positive().max(100_000),
  unit: z.enum(["G", "KG", "ML", "L", "ITEM", "PACKAGE"]),
  optional: z.boolean().default(false),
});

const nutrient = z.number().min(0).max(1000);

// Ảnh: ảnh nhóm món có sẵn (/assets/...) hoặc URL https (ảnh upload ở lượt 5 dùng API riêng).
const imageUrlSchema = z.string().trim().max(500).regex(/^(\/assets\/[\w.-]+|https:\/\/\S+)$/, "Đường dẫn ảnh không hợp lệ.");

export const recipeInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(1000),
  instructions: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  prepMinutes: z.number().int().min(0).max(600),
  cookMinutes: z.number().int().min(0).max(1440),
  servings: z.number().int().min(1).max(12).default(1),
  calories: z.number().int().min(0).max(5000),
  proteinG: nutrient,
  carbsG: nutrient,
  fatG: nutrient,
  fiberG: nutrient.default(0),
  cuisine: z.string().trim().min(1).max(50),
  dietTags: z.array(z.enum(["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"])).min(1).max(5),
  mealTypes: z.array(z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"])).min(1).max(4),
  imageUrl: imageUrlSchema.nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1).max(40),
});

export const listAdminRecipesSchema = z.object({
  body: empty,
  params: empty,
  query: z.object({
    search: z.string().trim().max(80).optional(),
    status: z.enum(["all", "visible", "hidden"]).default("all"),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export const adminRecipeIdSchema = z.object({ body: empty, params: idParams, query: empty });
export const createAdminRecipeSchema = z.object({ body: recipeInputSchema, params: empty, query: empty });
export const updateAdminRecipeSchema = z.object({ body: recipeInputSchema, params: idParams, query: empty });
export const setRecipeVisibilitySchema = z.object({ body: z.object({ hidden: z.boolean() }), params: idParams, query: empty });

export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type AdminRecipeListQuery = z.infer<typeof listAdminRecipesSchema>["query"];
export type AdminRecipeIdParams = z.infer<typeof idParams>;
