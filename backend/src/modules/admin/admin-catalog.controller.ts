import type { Request, Response } from "express";
import type { AuthenticatedRequest, ValidatedRequest } from "../../types/http.js";
import type { CatalogCreateInput, CatalogKind, CatalogUpdateInput } from "./admin-catalog.schema.js";
import { createCatalogEntry, listCatalogForAdmin, updateCatalogEntry } from "./admin-catalog.service.js";

const adminId = (req: Request) => (req as AuthenticatedRequest).userId;

export async function listCatalogController(_req: Request, res: Response) {
  res.json(await listCatalogForAdmin());
}

export async function createCatalogController(req: ValidatedRequest<Omit<CatalogCreateInput, "kind">, { kind: CatalogKind }>, res: Response) {
  res.status(201).json(await createCatalogEntry(adminId(req), { ...req.body, kind: req.params.kind } as CatalogCreateInput));
}

export async function updateCatalogController(
  req: ValidatedRequest<Omit<CatalogUpdateInput, "kind">, { kind: CatalogKind; id: string }>, res: Response,
) {
  res.json(await updateCatalogEntry(adminId(req), req.params.id, { ...req.body, kind: req.params.kind } as CatalogUpdateInput));
}
