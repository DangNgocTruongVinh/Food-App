import { Router } from "express";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createAdminRecipeController,
  deleteAdminRecipeController,
  getAdminRecipeController,
  listAdminRecipesController,
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

// Mọi API Admin: đăng nhập (quyền và trạng thái khóa đọc từ DB) rồi mới kiểm tra quyền ADMIN.
const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/recipes", validate(listAdminRecipesSchema), asyncHandler(listAdminRecipesController));
router.post("/recipes", validate(createAdminRecipeSchema), asyncHandler(createAdminRecipeController));
router.get("/recipes/:id", validate(adminRecipeIdSchema), asyncHandler(getAdminRecipeController));
router.put("/recipes/:id", validate(updateAdminRecipeSchema), asyncHandler(updateAdminRecipeController));
router.patch("/recipes/:id/visibility", validate(setRecipeVisibilitySchema), asyncHandler(setAdminRecipeVisibilityController));
router.delete("/recipes/:id", validate(adminRecipeIdSchema), asyncHandler(deleteAdminRecipeController));

export default router;
