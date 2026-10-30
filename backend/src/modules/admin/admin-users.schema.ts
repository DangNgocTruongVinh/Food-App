import { z } from "zod";

const empty = z.object({});
const page = z.coerce.number().int().min(1).max(10_000).default(1);
const pageSize = z.coerce.number().int().min(1).max(50).default(20);

export const listAdminUsersSchema = z.object({
  body: empty,
  params: empty,
  query: z.object({ search: z.string().trim().max(80).optional(), page, pageSize }),
});

export const setUserLockSchema = z.object({
  body: z.object({ locked: z.boolean() }),
  params: z.object({ id: z.string().cuid() }),
  query: empty,
});

export const listModerationPostsSchema = z.object({ body: empty, params: empty, query: z.object({ page, pageSize }) });
export const moderatePostSchema = z.object({ body: empty, params: z.object({ postId: z.string().cuid() }), query: empty });
export const moderateCommentSchema = z.object({ body: empty, params: z.object({ commentId: z.string().cuid() }), query: empty });
export const adminStatsSchema = z.object({ body: empty, params: empty, query: empty });

export type AdminUserListQuery = z.infer<typeof listAdminUsersSchema>["query"];
