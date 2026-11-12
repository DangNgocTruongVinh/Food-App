import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import type { AuthenticatedRequest } from "../../types/http.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getNutritionReport, getWasteReport } from "./reports.service.js";

const empty = z.object({});
export const wasteReportSchema = z.object({
  body: empty, params: empty, query: z.object({ weeks: z.enum(["4", "8"]).default("4") }).strict(),
});
export const nutritionReportSchema = z.object({
  body: empty, params: empty, query: z.object({ week: z.enum(["current", "previous"]).default("current") }).strict(),
});

const userIdOf = (req: Request) => (req as AuthenticatedRequest).userId;

const router = Router();
router.use(requireAuth);
// validate() không ghi đè req.query: parse lại để có giá trị mặc định.
router.get("/waste", validate(wasteReportSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json(await getWasteReport(userIdOf(req), Number(wasteReportSchema.shape.query.parse(req.query).weeks)));
}));
router.get("/nutrition", validate(nutritionReportSchema), asyncHandler(async (req: Request, res: Response) => {
  res.json(await getNutritionReport(userIdOf(req), nutritionReportSchema.shape.query.parse(req.query).week));
}));

export default router;
