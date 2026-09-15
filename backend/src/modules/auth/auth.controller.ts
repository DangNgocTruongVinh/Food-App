import type { Response } from "express";
import type { ValidatedRequest } from "../../types/http.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import { login, register } from "./auth.service.js";

export async function registerController(req: ValidatedRequest<RegisterInput>, res: Response) {
  res.status(201).json(await register(req.body));
}

export async function loginController(req: ValidatedRequest<LoginInput>, res: Response) {
  res.json(await login(req.body));
}
