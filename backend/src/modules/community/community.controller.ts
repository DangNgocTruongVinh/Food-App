import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type {
  AddCommunityCommentBody,
  CommunityPostIdParams,
  CreateCommunityPostBody,
  UpdateCommunityPostBody,
} from "./community.schema.js";
import { updateCommunityPost } from "./community-post-edit.service.js";
import {
  addCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  listCommunityPosts,
  toggleCommunityLike,
} from "./community.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function listCommunityPostsController(req: Request, res: Response) {
  res.json(await listCommunityPosts(authenticatedUserId(req)));
}

export async function createCommunityPostController(
  req: ValidatedRequest<CreateCommunityPostBody>,
  res: Response,
) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  res.status(201).json(await createCommunityPost(authenticatedUserId(req), req.body, files.map((file) => file.buffer)));
}

/** "Xóa bài của tôi": chỉ tác giả (userId từ JWT); bài người khác hoặc không tồn tại → 404. */
export async function deleteOwnCommunityPostController(
  req: ValidatedRequest<Record<string, never>, CommunityPostIdParams>,
  res: Response,
) {
  await deleteCommunityPost(req.params.postId, { userId: authenticatedUserId(req), isAdmin: false });
  res.status(204).end();
}

/** Sửa bài của tôi (nội dung, công thức tự viết): chỉ tác giả; bài người khác hoặc không tồn tại → 404. */
export async function updateOwnCommunityPostController(
  req: ValidatedRequest<UpdateCommunityPostBody, CommunityPostIdParams>,
  res: Response,
) {
  res.json(await updateCommunityPost(authenticatedUserId(req), req.params.postId, req.body));
}

export async function toggleCommunityLikeController(
  req: ValidatedRequest<Record<string, never>, CommunityPostIdParams>,
  res: Response,
) {
  res.json(await toggleCommunityLike(authenticatedUserId(req), req.params.postId));
}

export async function addCommunityCommentController(
  req: ValidatedRequest<AddCommunityCommentBody, CommunityPostIdParams>,
  res: Response,
) {
  res.status(201).json(await addCommunityComment(authenticatedUserId(req), req.params.postId, req.body.content));
}
