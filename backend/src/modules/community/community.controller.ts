import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type {
  AddCommunityCommentBody,
  CommunityPostIdParams,
  CreateCommunityPostBody,
} from "./community.schema.js";
import {
  addCommunityComment,
  createCommunityPost,
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
  res.status(201).json(await createCommunityPost(authenticatedUserId(req), req.body.content));
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
