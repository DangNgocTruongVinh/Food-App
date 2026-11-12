import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import { getCommunityPostForModeration, reviewFlaggedPost, setCommunityPostHidden } from "../community/community-post-edit.service.js";
import {
  deleteCommunityComment, deleteCommunityPost, listCommunityPostsForModeration,
} from "../community/community.service.js";
import { estimateRecipeFromPost } from "./admin-recipe-estimate.service.js";
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
  const { page, pageSize, filter } = listModerationPostsSchema.shape.query.parse(req.query);
  res.json(await listCommunityPostsForModeration(page, pageSize, filter));
}

/** Một bài (form "Chuyển thành công thức" điền trước từ công thức tự viết). */
export async function getModerationPostController(req: ValidatedRequest<unknown, { postId: string }>, res: Response) {
  res.json(await getCommunityPostForModeration(req.params.postId));
}

/** Ẩn/hiện bài vi phạm (không xóa); ghi nhật ký Admin. */
export async function setPostVisibilityController(req: ValidatedRequest<{ hidden: boolean }, { postId: string }>, res: Response) {
  res.json(await setCommunityPostHidden(adminId(req), req.params.postId, req.body.hidden));
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

/** Bài AI đánh dấu: Duyệt (hiện cho mọi người) hoặc Ẩn. */
export async function reviewPostController(req: ValidatedRequest<{ decision: "approve" | "hide" }, { postId: string }>, res: Response) {
  res.json(await reviewFlaggedPost(adminId(req), req.params.postId, req.body.decision));
}

/** AI ước tính dinh dưỡng, chuẩn hóa tên nguyên liệu cho form "Chuyển thành công thức" (không lưu gì). */
export async function estimatePostRecipeController(req: ValidatedRequest<unknown, { postId: string }>, res: Response) {
  res.json(await estimateRecipeFromPost(req.params.postId));
}
