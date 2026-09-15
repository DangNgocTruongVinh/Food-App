import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type { UpdateProfileInput } from "./profile.schema.js";
import { getProfile, updateProfile } from "./profile.service.js";

export async function getProfileController(req: Request, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  res.json(await getProfile(userId));
}

export async function updateProfileController(req: ValidatedRequest<UpdateProfileInput>, res: Response) {
  const userId = (req as AuthenticatedRequest).userId;
  res.json(await updateProfile(userId, req.body));
}
