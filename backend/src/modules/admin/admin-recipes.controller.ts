import type { Request, Response } from "express";
import type { ValidatedRequest } from "../../types/http.js";
import {
  createRecipe, deleteRecipe, getRecipeForAdmin, listRecipesForAdmin, replaceRecipeImage, setRecipeVisibility, updateRecipe,
} from "../recipes/recipe-management.service.js";
import { type AdminRecipeIdParams, listAdminRecipesSchema, type RecipeInput } from "./admin-recipes.schema.js";

// validate() không ghi đè req.query (Express 5 chỉ cho đọc) nên đọc lại query đã kiểm tra để có giá trị mặc định.
export async function listAdminRecipesController(req: Request, res: Response) {
  res.json(await listRecipesForAdmin(listAdminRecipesSchema.shape.query.parse(req.query)));
}

export async function getAdminRecipeController(req: ValidatedRequest<unknown, AdminRecipeIdParams>, res: Response) {
  res.json(await getRecipeForAdmin(req.params.id));
}

export async function createAdminRecipeController(req: ValidatedRequest<RecipeInput>, res: Response) {
  res.status(201).json(await createRecipe(req.body));
}

export async function updateAdminRecipeController(req: ValidatedRequest<RecipeInput, AdminRecipeIdParams>, res: Response) {
  res.json(await updateRecipe(req.params.id, req.body));
}

export async function setAdminRecipeVisibilityController(
  req: ValidatedRequest<{ hidden: boolean }, AdminRecipeIdParams>,
  res: Response,
) {
  res.json(await setRecipeVisibility(req.params.id, req.body.hidden));
}

/** File ảnh đã được singleImageUpload kiểm tra (định dạng, dung lượng) trước khi tới đây. */
export async function replaceAdminRecipeImageController(req: ValidatedRequest<unknown, AdminRecipeIdParams>, res: Response) {
  res.json(await replaceRecipeImage(req.params.id, req.file!.buffer));
}

export async function deleteAdminRecipeController(req: ValidatedRequest<unknown, AdminRecipeIdParams>, res: Response) {
  await deleteRecipe(req.params.id);
  res.status(204).end();
}
