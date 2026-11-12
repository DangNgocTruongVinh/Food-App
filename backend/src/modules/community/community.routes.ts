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
  listSavedPostsController,
  savePostController,
  toggleCommunityLikeController,
  unsavePostController,
  updateOwnCommunityPostController,
} from "./community.controller.js";
import {
  addCommunityCommentSchema,
  createCommunityPostSchema,
  deleteCommunityPostSchema,
  listCommunityPostsSchema,
  savePostSchema,
  toggleCommunityLikeSchema,
  updateCommunityPostSchema,
} from "./community.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listCommunityPostsSchema), asyncHandler(listCommunityPostsController));
router.post("/", communityPostImagesUpload, validate(createCommunityPostSchema), asyncHandler(createCommunityPostController));
router.patch("/:postId", validate(updateCommunityPostSchema), asyncHandler(updateOwnCommunityPostController));
router.delete("/:postId", validate(deleteCommunityPostSchema), asyncHandler(deleteOwnCommunityPostController));
// UC25 Lưu bài: chỉ danh sách của chính người dùng (userId từ JWT).
router.get("/saved", validate(listCommunityPostsSchema), asyncHandler(listSavedPostsController));
router.put("/:postId/save", validate(savePostSchema), asyncHandler(savePostController));
router.delete("/:postId/save", validate(savePostSchema), asyncHandler(unsavePostController));
router.post("/:postId/like", validate(toggleCommunityLikeSchema), asyncHandler(toggleCommunityLikeController));
router.post("/:postId/comments", validate(addCommunityCommentSchema), asyncHandler(addCommunityCommentController));

export default router;
