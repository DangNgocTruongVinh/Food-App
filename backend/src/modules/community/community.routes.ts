import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  addCommunityCommentController,
  createCommunityPostController,
  listCommunityPostsController,
  toggleCommunityLikeController,
} from "./community.controller.js";
import {
  addCommunityCommentSchema,
  createCommunityPostSchema,
  listCommunityPostsSchema,
  toggleCommunityLikeSchema,
} from "./community.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listCommunityPostsSchema), asyncHandler(listCommunityPostsController));
router.post("/", validate(createCommunityPostSchema), asyncHandler(createCommunityPostController));
router.post("/:postId/like", validate(toggleCommunityLikeSchema), asyncHandler(toggleCommunityLikeController));
router.post("/:postId/comments", validate(addCommunityCommentSchema), asyncHandler(addCommunityCommentController));

export default router;
