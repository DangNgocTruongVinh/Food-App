import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getAIStatusController, listChatHistoryController, sendChatMessageController } from "./ai.controller.js";
import { aiStatusSchema, chatSchema, listChatHistorySchema } from "./ai.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/status", validate(aiStatusSchema), asyncHandler(getAIStatusController));
router.get("/history", validate(listChatHistorySchema), asyncHandler(listChatHistoryController));
router.post("/chat", validate(chatSchema), asyncHandler(sendChatMessageController));

export default router;
