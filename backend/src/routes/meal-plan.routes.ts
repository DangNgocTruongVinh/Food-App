import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { generateWeeklyPlan, planInclude } from "../services/meal-plan.service.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
router.use(requireAuth);
const empty = z.object({});
const idParams = z.object({ id: z.string().cuid() });

router.get("/", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  res.json(await prisma.mealPlan.findMany({ where: { userId }, include: planInclude, orderBy: { startDate: "desc" } }));
}));

router.get("/:id", validate(z.object({ body: empty, params: idParams, query: empty })), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const plan = await prisma.mealPlan.findFirst({ where: { id: String(req.params.id), userId }, include: planInclude });
  if (!plan) throw new HttpError(404, "Không tìm thấy thực đơn.");
  res.json(plan);
}));

router.post("/generate", validate(z.object({
  body: z.object({ startDate: z.string().date() }), params: empty, query: empty,
})), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  res.status(201).json(await generateWeeklyPlan(userId, req.body.startDate));
}));

router.patch("/:id/status", validate(z.object({
  body: z.object({ status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]) }), params: idParams, query: empty,
})), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = String(req.params.id);
  const result = await prisma.mealPlan.updateMany({ where: { id, userId }, data: { status: req.body.status } });
  if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
  res.json(await prisma.mealPlan.findUnique({ where: { id }, include: planInclude }));
}));

router.patch("/items/:id", validate(z.object({
  body: z.object({ completed: z.boolean() }), params: idParams, query: empty,
})), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const item = await prisma.mealPlanItem.findFirst({ where: { id: String(req.params.id), day: { mealPlan: { userId } } } });
  if (!item) throw new HttpError(404, "Không tìm thấy bữa ăn.");
  res.json(await prisma.mealPlanItem.update({ where: { id: item.id }, data: { completed: req.body.completed } }));
}));

router.patch("/shopping/:id", validate(z.object({
  body: z.object({ purchased: z.boolean() }), params: idParams, query: empty,
})), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const item = await prisma.shoppingItem.findFirst({ where: { id: String(req.params.id), mealPlan: { userId } } });
  if (!item) throw new HttpError(404, "Không tìm thấy nguyên liệu mua sắm.");
  res.json(await prisma.shoppingItem.update({ where: { id: item.id }, data: { purchased: req.body.purchased } }));
}));

router.delete("/:id", validate(z.object({ body: empty, params: idParams, query: empty })), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const result = await prisma.mealPlan.deleteMany({ where: { id: String(req.params.id), userId } });
  if (!result.count) throw new HttpError(404, "Không tìm thấy thực đơn.");
  res.status(204).send();
}));

export default router;
