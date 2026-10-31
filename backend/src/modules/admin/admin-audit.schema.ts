import { z } from "zod";

const empty = z.object({});

export const listAdminAuditLogsSchema = z.object({
  body: empty,
  params: empty,
  query: z.object({
    action: z.enum([
      "RECIPE_CREATE", "RECIPE_UPDATE", "RECIPE_HIDE", "RECIPE_SHOW", "RECIPE_DELETE", "RECIPE_IMAGE_REPLACE",
      "USER_LOCK", "USER_UNLOCK", "POST_DELETE", "COMMENT_DELETE",
    ]).optional(),
    targetType: z.enum(["RECIPE", "USER", "COMMUNITY_POST", "COMMUNITY_COMMENT"]).optional(),
    targetId: z.string().cuid().optional(),
    actorId: z.string().cuid().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export type AdminAuditLogQuery = z.infer<typeof listAdminAuditLogsSchema>["query"];
