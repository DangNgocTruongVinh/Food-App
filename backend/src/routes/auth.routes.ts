import { Router } from "express";
import { z } from "zod";
import { login, register } from "../services/auth.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middleware/validate.js";

const router = Router();
const credentials = z.object({
  body: z.object({ email: z.string().email(), password: z.string().min(8).max(72) }),
  params: z.object({}), query: z.object({}),
});

router.post("/register", validate(credentials.extend({ body: credentials.shape.body.extend({ name: z.string().min(2).max(80) }) })), asyncHandler(async (req, res) => {
  res.status(201).json(await register(req.body));
}));

router.post("/login", validate(credentials), asyncHandler(async (req, res) => {
  res.json(await login(req.body));
}));

export default router;
