import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { communityPostImagesUpload } from "../../middleware/image-upload.js";
import { byUser, rateLimit } from "../../middleware/rate-limit.js";
import { USER_RATE_LIMITS } from "../../shared/limits.js";
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

// Giới hạn theo tài khoản (audit S3), đặt sau requireAuth. Đăng và sửa bài dùng chung một bộ đếm (mỗi lần gọi AI kiểm duyệt).
const L = USER_RATE_LIMITS;
export const postWriteLimit = rateLimit({ ...L.postWrites, keyOf: byUser,
  message: `Bạn đã đăng hoặc sửa bài ${L.postWrites.max} lần trong 1 giờ. Vui lòng thử lại sau.` });
export const commentLimit = rateLimit({ ...L.comments, keyOf: byUser, message: "Bạn bình luận quá nhanh. Vui lòng đợi vài phút rồi thử lại." });
export const likeLimit = rateLimit({ ...L.likes, keyOf: byUser, message: "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại." });

router.get("/", validate(listCommunityPostsSchema), asyncHandler(listCommunityPostsController));
router.post("/", postWriteLimit, communityPostImagesUpload, validate(createCommunityPostSchema), asyncHandler(createCommunityPostController));
router.patch("/:postId", validate(updateCommunityPostSchema), postWriteLimit, asyncHandler(updateOwnCommunityPostController));
router.delete("/:postId", validate(deleteCommunityPostSchema), asyncHandler(deleteOwnCommunityPostController));
// UC25 Lưu bài: chỉ danh sách của chính người dùng (userId từ JWT).
router.get("/saved", validate(listCommunityPostsSchema), asyncHandler(listSavedPostsController));
router.put("/:postId/save", validate(savePostSchema), asyncHandler(savePostController));
router.delete("/:postId/save", validate(savePostSchema), asyncHandler(unsavePostController));
router.post("/:postId/like", validate(toggleCommunityLikeSchema), likeLimit, asyncHandler(toggleCommunityLikeController));
router.post("/:postId/comments", validate(addCommunityCommentSchema), commentLimit, asyncHandler(addCommunityCommentController));

export default router;
