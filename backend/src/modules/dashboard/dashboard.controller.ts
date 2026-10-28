import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../types/http.js";
import { getDashboard } from "./dashboard.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function getDashboardController(req: Request, res: Response) {
  res.json(await getDashboard(authenticatedUserId(req)));
}
