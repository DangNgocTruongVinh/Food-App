import { z } from "zod";

const empty = z.object({});
const postIdParams = z.object({ postId: z.string().cuid() });

export const listCommunityPostsSchema = z.object({
  body: empty,
  params: empty,
  query: empty,
});

export const createCommunityPostSchema = z.object({
  body: z.object({ content: z.string().trim().min(1).max(2000) }),
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

export type CreateCommunityPostBody = z.infer<typeof createCommunityPostSchema>["body"];
export type CommunityPostIdParams = z.infer<typeof postIdParams>;
export type AddCommunityCommentBody = z.infer<typeof addCommunityCommentSchema>["body"];
