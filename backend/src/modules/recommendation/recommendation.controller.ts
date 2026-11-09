import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../types/http.js";
import { recommendationsSchema } from "./recommendation.schema.js";
import { getRecommendations } from "./recommendation.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function getRecommendationsController(req: Request, res: Response) {
  // validate() không ghi đè req.query → parse lại để có giá trị mặc định (limit) và kiểu đã kiểm tra.
  res.json(await getRecommendations(authenticatedUserId(req), recommendationsSchema.shape.query.parse(req.query)));
}
