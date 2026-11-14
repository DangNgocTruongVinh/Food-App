import type { Request, Response } from "express";
import { getPublicCatalog } from "../../services/catalog/catalog.service.js";

export async function getCatalogController(_req: Request, res: Response) {
  res.json(await getPublicCatalog());
}
