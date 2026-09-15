import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type { ChatInput } from "./ai.schema.js";
import { listChatHistory, sendChatMessage } from "./chat.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function listChatHistoryController(req: Request, res: Response) {
  res.json(await listChatHistory(authenticatedUserId(req)));
}

export async function sendChatMessageController(req: ValidatedRequest<ChatInput>, res: Response) {
  res.json(await sendChatMessage(authenticatedUserId(req), req.body.message));
}
