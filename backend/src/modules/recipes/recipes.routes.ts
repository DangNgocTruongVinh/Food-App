import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  addFavoriteRecipeController, getFeaturedRecipesController, getRecipeController, getRecipeForYouController, getRecipeStatsController,
  listFavoriteRecipesController, listRecipesController, removeFavoriteRecipeController,
} from "./recipes.controller.js";
import {
  featuredRecipesSchema, getRecipeSchema, listFavoriteRecipesSchema, listRecipesSchema, recipeStatsSchema,
} from "./recipes.schema.js";

const router = Router();
// Công khai cho Landing (Guest): đặt trước requireAuth. /stats chỉ trả số đếm theo nhóm; /featured chỉ trả trường tóm tắt của món đang hiện.
router.get("/stats", validate(recipeStatsSchema), asyncHandler(getRecipeStatsController));
router.get("/featured", validate(featuredRecipesSchema), asyncHandler(getFeaturedRecipesController));
router.use(requireAuth);

router.get("/", validate(listRecipesSchema), asyncHandler(listRecipesController));
// UC24: đặt trước "/:id". Chỉ danh sách của chính người dùng (userId từ JWT).
router.get("/favorites", validate(listFavoriteRecipesSchema), asyncHandler(listFavoriteRecipesController));
router.put("/:id/favorite", validate(getRecipeSchema), asyncHandler(addFavoriteRecipeController));
router.delete("/:id/favorite", validate(getRecipeSchema), asyncHandler(removeFavoriteRecipeController));
router.get("/:id", validate(getRecipeSchema), asyncHandler(getRecipeController));
router.get("/:id/for-you", validate(getRecipeSchema), asyncHandler(getRecipeForYouController));

export default router;
