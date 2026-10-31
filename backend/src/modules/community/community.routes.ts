import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { communityPostImagesUpload } from "../../middleware/image-upload.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  addCommunityCommentController,
  createCommunityPostController,
  deleteOwnCommunityPostController,
  listCommunityPostsController,
  toggleCommunityLikeController,
} from "./community.controller.js";
import {
  addCommunityCommentSchema,
  createCommunityPostSchema,
  deleteCommunityPostSchema,
  listCommunityPostsSchema,
  toggleCommunityLikeSchema,
} from "./community.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listCommunityPostsSchema), asyncHandler(listCommunityPostsController));
router.post("/", communityPostImagesUpload, validate(createCommunityPostSchema), asyncHandler(createCommunityPostController));
router.delete("/:postId", validate(deleteCommunityPostSchema), asyncHandler(deleteOwnCommunityPostController));
router.post("/:postId/like", validate(toggleCommunityLikeSchema), asyncHandler(toggleCommunityLikeController));
router.post("/:postId/comments", validate(addCommunityCommentSchema), asyncHandler(addCommunityCommentController));

export default router;
