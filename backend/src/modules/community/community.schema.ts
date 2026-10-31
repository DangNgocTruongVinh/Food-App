import { z } from "zod";

const empty = z.object({});
const postIdParams = z.object({ postId: z.string().cuid() });

export const listCommunityPostsSchema = z.object({
  body: empty,
  params: empty,
  query: empty,
});

// Gửi JSON hoặc multipart (kèm trường "images"). Điều kiện "có chữ, công thức hoặc ảnh" kiểm tra trong service
// vì cần biết số ảnh; bài không có chữ thì nội dung lưu "".
export const createCommunityPostSchema = z.object({
  body: z.object({
    content: z.string().trim().max(2000).default(""),
    recipeId: z.string().cuid().optional(),
  }),
  params: empty,
  query: empty,
});

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
export type CommunityPostIdParams = z.infer<typeof postIdParams>;
export type AddCommunityCommentBody = z.infer<typeof addCommunityCommentSchema>["body"];
