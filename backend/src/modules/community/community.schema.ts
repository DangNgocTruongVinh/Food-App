import { z } from "zod";
import { memberRecipeField, memberRecipeSchema } from "./community-member-recipe.js";

const empty = z.object({});
const postIdParams = z.object({ postId: z.string().cuid() });

export const listCommunityPostsSchema = z.object({
  body: empty,
  params: empty,
  query: empty,
});

const ONE_RECIPE_ONLY = "Chỉ chọn một: đính kèm món có sẵn hoặc tự viết công thức.";

// Gửi JSON hoặc multipart (kèm trường "images"; công thức tự viết là chuỗi JSON). Điều kiện "có chữ, công thức hoặc ảnh"
// kiểm tra trong service vì cần biết số ảnh; bài không có chữ thì nội dung lưu "".
export const createCommunityPostSchema = z.object({
  body: z.object({
    content: z.string().trim().max(2000).default(""),
    recipeId: z.string().cuid().optional(),
    memberRecipe: memberRecipeField.optional(),
  }).refine((body) => !(body.recipeId && body.memberRecipe), { message: ONE_RECIPE_ONLY, path: ["memberRecipe"] }),
  params: empty,
  query: empty,
});

// Tác giả sửa bài: nội dung và công thức tự viết (null = bỏ công thức). Ảnh và món đính kèm giữ nguyên.
export const updateCommunityPostSchema = z.object({
  body: z.object({
    content: z.string().trim().max(2000),
    memberRecipe: memberRecipeSchema.nullable(),
  }).strict(),
  params: postIdParams,
  query: empty,
});

export const savePostSchema = z.object({ body: empty, params: postIdParams, query: empty });

export const toggleCommunityLikeSchema = z.object({
  body: empty,
  params: postIdParams,
  query: empty,
});

export const addCommunityCommentSchema = z.object({
  body: z.object({ content: z.string().trim().min(1).max(500) }),
  params: postIdParams,
  query: empty,
});

export const deleteCommunityPostSchema = z.object({
  body: empty,
  params: postIdParams,
  query: empty,
});

export type CreateCommunityPostBody = z.infer<typeof createCommunityPostSchema>["body"];
export type UpdateCommunityPostBody = z.infer<typeof updateCommunityPostSchema>["body"];
export type CommunityPostIdParams = z.infer<typeof postIdParams>;
export type AddCommunityCommentBody = z.infer<typeof addCommunityCommentSchema>["body"];
