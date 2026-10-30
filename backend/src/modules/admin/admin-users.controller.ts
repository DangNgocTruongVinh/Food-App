import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import {
  deleteCommunityComment, deleteCommunityPost, listCommunityPostsForModeration,
} from "../community/community.service.js";
import { getAdminStats } from "./admin-stats.service.js";
import { listUsersForAdmin, setUserLock } from "./admin-users.service.js";
import { listAdminUsersSchema, listModerationPostsSchema } from "./admin-users.schema.js";

// Người dùng, kiểm duyệt cộng đồng và thống kê. Query đọc lại từ schema để có giá trị mặc định (validate() không ghi đè req.query).
const adminId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function listAdminUsersController(req: Request, res: Response) {
  res.json(await listUsersForAdmin(listAdminUsersSchema.shape.query.parse(req.query)));
}

export async function setUserLockController(req: ValidatedRequest<{ locked: boolean }, { id: string }>, res: Response) {
  res.json(await setUserLock(adminId(req), req.params.id, req.body.locked));
}

export async function listModerationPostsController(req: Request, res: Response) {
  const { page, pageSize } = listModerationPostsSchema.shape.query.parse(req.query);
  res.json(await listCommunityPostsForModeration(page, pageSize));
}

export async function moderateDeletePostController(req: ValidatedRequest<unknown, { postId: string }>, res: Response) {
  await deleteCommunityPost(req.params.postId, { userId: adminId(req), isAdmin: true });
  res.status(204).end();
}

export async function moderateDeleteCommentController(req: ValidatedRequest<unknown, { commentId: string }>, res: Response) {
  await deleteCommunityComment(req.params.commentId, { userId: adminId(req), isAdmin: true });
  res.status(204).end();
}

export async function adminStatsController(_req: Request, res: Response) {
  res.json(await getAdminStats());
}
