import { z } from "zod";

const empty = z.object({});
const postIdParams = z.object({ postId: z.string().cuid() });

export const listCommunityPostsSchema = z.object({
  body: empty,
  params: empty,
  query: empty,
});

// Bài viết cần có chữ hoặc công thức đính kèm (hoặc cả hai); chỉ có công thức thì nội dung lưu "".
export const createCommunityPostSchema = z.object({
  body: z.object({
    content: z.string().trim().max(2000).default(""),
    recipeId: z.string().cuid().optional(),
  }).refine((body) => body.content.length > 0 || body.recipeId !== undefined, {
    message: "Bài viết cần có nội dung hoặc công thức.",
    path: ["content"],
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
