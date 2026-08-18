import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(z.object({
  body: z.object({}), params: z.object({}),
  query: z.object({ search: z.string().max(80).optional(), cuisine: z.string().max(50).optional() }),
})), asyncHandler(async (req, res) => {
  const { search, cuisine } = req.query as { search?: string; cuisine?: string };
  res.json(await prisma.recipe.findMany({
    where: {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(cuisine ? { cuisine } : {}),
    },
    include: { ingredients: true }, orderBy: { name: "asc" },
  }));
}));

router.get("/:id", validate(z.object({ body: z.object({}), params: z.object({ id: z.string().cuid() }), query: z.object({}) })), asyncHandler(async (req, res) => {
  const recipe = await prisma.recipe.findUnique({ where: { id: String(req.params.id) }, include: { ingredients: true } });
  res.status(recipe ? 200 : 404).json(recipe ?? { message: "Không tìm thấy công thức." });
}));

export default router;
