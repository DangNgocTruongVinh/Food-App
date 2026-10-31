import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { singleImageUpload } from "../../middleware/image-upload.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { listAdminAuditLogsController } from "./admin-audit.controller.js";
import { listAdminAuditLogsSchema } from "./admin-audit.schema.js";
import {
  createAdminRecipeController,
  deleteAdminRecipeController,
  getAdminRecipeController,
  listAdminRecipesController,
  replaceAdminRecipeImageController,
  setAdminRecipeVisibilityController,
  updateAdminRecipeController,
} from "./admin-recipes.controller.js";
import {
  adminRecipeIdSchema,
  createAdminRecipeSchema,
  listAdminRecipesSchema,
  setRecipeVisibilitySchema,
  updateAdminRecipeSchema,
} from "./admin-recipes.schema.js";
import {
  adminStatsController,
  listAdminUsersController,
  listModerationPostsController,
  moderateDeleteCommentController,
  moderateDeletePostController,
  setUserLockController,
} from "./admin-users.controller.js";
import {
  adminStatsSchema,
  listAdminUsersSchema,
  listModerationPostsSchema,
  moderateCommentSchema,
  moderatePostSchema,
  setUserLockSchema,
} from "./admin-users.schema.js";

// Mọi API Admin: đăng nhập (quyền và trạng thái khóa đọc từ DB) rồi mới kiểm tra quyền ADMIN.
const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/recipes", validate(listAdminRecipesSchema), asyncHandler(listAdminRecipesController));
router.post("/recipes", validate(createAdminRecipeSchema), asyncHandler(createAdminRecipeController));
router.get("/recipes/:id", validate(adminRecipeIdSchema), asyncHandler(getAdminRecipeController));
router.put("/recipes/:id", validate(updateAdminRecipeSchema), asyncHandler(updateAdminRecipeController));
router.patch("/recipes/:id/visibility", validate(setRecipeVisibilitySchema), asyncHandler(setAdminRecipeVisibilityController));
router.put("/recipes/:id/image", validate(adminRecipeIdSchema), singleImageUpload, asyncHandler(replaceAdminRecipeImageController));
router.delete("/recipes/:id", validate(adminRecipeIdSchema), asyncHandler(deleteAdminRecipeController));

router.get("/users", validate(listAdminUsersSchema), asyncHandler(listAdminUsersController));
router.patch("/users/:id/lock", validate(setUserLockSchema), asyncHandler(setUserLockController));

router.get("/community/posts", validate(listModerationPostsSchema), asyncHandler(listModerationPostsController));
router.delete("/community/posts/:postId", validate(moderatePostSchema), asyncHandler(moderateDeletePostController));
router.delete("/community/comments/:commentId", validate(moderateCommentSchema), asyncHandler(moderateDeleteCommentController));

router.get("/stats", validate(adminStatsSchema), asyncHandler(adminStatsController));

router.get("/audit-logs", validate(listAdminAuditLogsSchema), asyncHandler(listAdminAuditLogsController));

export default router;
