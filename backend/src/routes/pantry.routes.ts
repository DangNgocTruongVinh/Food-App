import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import type { AuthenticatedRequest } from "../types/http.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";

const router = Router();
router.use(requireAuth);
const unit = z.enum(["G", "KG", "ML", "L", "ITEM", "PACKAGE"]);
const itemBody = z.object({
  name: z.string().min(1).max(100), category: z.string().min(1).max(50),
  quantity: z.number().nonnegative(), unit,
  expiryDate: z.string().date().nullable().optional(), minimumStock: z.number().nonnegative().optional(),
  note: z.string().max(300).nullable().optional(),
});
const empty = z.object({});

router.get("/", asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const items = await prisma.pantryItem.findMany({ where: { userId }, orderBy: [{ expiryDate: "asc" }, { name: "asc" }] });
  res.json(items);
}));

router.post("/", validate(z.object({ body: itemBody, params: empty, query: empty })), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const data = { ...req.body, expiryDate: req.body.expiryDate ? new Date(`${req.body.expiryDate}T00:00:00.000Z`) : null };
  res.status(201).json(await prisma.pantryItem.create({ data: { userId, ...data } }));
}));

router.put("/:id", validate(z.object({ body: itemBody.partial(), params: z.object({ id: z.string().cuid() }), query: empty })), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const id = String(req.params.id);
  const exists = await prisma.pantryItem.findFirst({ where: { id, userId } });
  if (!exists) throw new HttpError(404, "Không tìm thấy thực phẩm.");
  const data = { ...req.body, expiryDate: req.body.expiryDate ? new Date(`${req.body.expiryDate}T00:00:00.000Z`) : req.body.expiryDate };
  res.json(await prisma.pantryItem.update({ where: { id }, data }));
}));

router.delete("/:id", validate(z.object({ body: empty, params: z.object({ id: z.string().cuid() }), query: empty })), asyncHandler(async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const result = await prisma.pantryItem.deleteMany({ where: { id: String(req.params.id), userId } });
  if (!result.count) throw new HttpError(404, "Không tìm thấy thực phẩm.");
  res.status(204).send();
}));

export default router;
