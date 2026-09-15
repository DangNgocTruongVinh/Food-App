import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { listChatHistoryController, sendChatMessageController } from "./ai.controller.js";
import { chatSchema, listChatHistorySchema } from "./ai.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/history", validate(listChatHistorySchema), asyncHandler(listChatHistoryController));
router.post("/chat", validate(chatSchema), asyncHandler(sendChatMessageController));

export default router;
