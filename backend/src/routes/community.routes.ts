import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
const empty = z.object({});
const postIdParams = z.object({ postId: z.string().cuid() });
const authorSelect = { id: true, name: true } as const;

router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const posts = await prisma.communityPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      author: { select: authorSelect },
      likes: { where: { userId }, select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: authorSelect } },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  res.json(posts.map(({ likes, _count, ...post }) => ({
    ...post,
    likedByMe: likes.length > 0,
    likeCount: _count.likes,
    commentCount: _count.comments,
  })));
}));

router.post("/", validate(z.object({
  body: z.object({ content: z.string().trim().min(1).max(2000) }),
  params: empty,
  query: empty,
})), asyncHandler(async (req, res) => {
  const authorId = (req as AuthenticatedRequest).userId;
  const post = await prisma.communityPost.create({
    data: { authorId, content: req.body.content },
    include: { author: { select: authorSelect } },
  });

  res.status(201).json({ ...post, likedByMe: false, likeCount: 0, commentCount: 0, comments: [] });
}));

router.post("/:postId/like", validate(z.object({
  body: empty,
  params: postIdParams,
  query: empty,
})), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const postId = String(req.params.postId);
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new HttpError(404, "Không tìm thấy bài viết.");

  const existingLike = await prisma.communityLike.findUnique({ where: { postId_userId: { postId, userId } } });
  const liked = !existingLike;
  if (existingLike) {
    await prisma.communityLike.delete({ where: { postId_userId: { postId, userId } } });
  } else {
    await prisma.communityLike.create({ data: { postId, userId } });
  }

  res.json({ liked, likeCount: await prisma.communityLike.count({ where: { postId } }) });
}));

router.post("/:postId/comments", validate(z.object({
  body: z.object({ content: z.string().trim().min(1).max(500) }),
  params: postIdParams,
  query: empty,
})), asyncHandler(async (req, res) => {
  const authorId = (req as AuthenticatedRequest).userId;
  const postId = String(req.params.postId);
  const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw new HttpError(404, "Không tìm thấy bài viết.");

  const comment = await prisma.communityComment.create({
    data: { postId, authorId, content: req.body.content },
    include: { author: { select: authorSelect } },
  });
  res.status(201).json(comment);
}));

export default router;
