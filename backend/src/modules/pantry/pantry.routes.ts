import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createPantryController, deletePantryController, listPantryController, updatePantryController } from "./pantry.controller.js";
import { createPantrySchema, deletePantrySchema, listPantrySchema, updatePantrySchema } from "./pantry.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listPantrySchema), asyncHandler(listPantryController));
router.post("/", validate(createPantrySchema), asyncHandler(createPantryController));
router.put("/:id", validate(updatePantrySchema), asyncHandler(updatePantryController));
router.delete("/:id", validate(deletePantrySchema), asyncHandler(deletePantryController));

export default router;
