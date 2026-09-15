import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type { CreatePantryInput, PantryIdParams, UpdatePantryInput } from "./pantry.schema.js";
import { createPantryItem, deletePantryItem, listPantryItems, updatePantryItem } from "./pantry.service.js";

const authenticatedUserId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function listPantryController(req: Request, res: Response) {
  res.json(await listPantryItems(authenticatedUserId(req)));
}

export async function createPantryController(req: ValidatedRequest<CreatePantryInput>, res: Response) {
  res.status(201).json(await createPantryItem(authenticatedUserId(req), req.body));
}

export async function updatePantryController(req: ValidatedRequest<UpdatePantryInput, PantryIdParams>, res: Response) {
  res.json(await updatePantryItem(authenticatedUserId(req), req.params.id, req.body));
}

export async function deletePantryController(req: ValidatedRequest<unknown, PantryIdParams>, res: Response) {
  await deletePantryItem(authenticatedUserId(req), req.params.id);
  res.status(204).send();
}
