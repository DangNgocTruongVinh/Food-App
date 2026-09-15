import { z } from "zod";

const empty = z.object({});
const unitSchema = z.enum(["G", "KG", "ML", "L", "ITEM", "PACKAGE"]);
const storageLocationSchema = z.enum(["REFRIGERATOR", "FREEZER", "DRY_STORAGE"]);
const normalizedText = (max: number) => z.string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(max));

export const pantryItemSchema = z.object({
  name: normalizedText(100),
  category: normalizedText(50),
  quantity: z.number().nonnegative(),
  unit: unitSchema,
  storageLocation: storageLocationSchema.optional(),
  expiryDate: z.string().date().nullable().optional(),
  minimumStock: z.number().nonnegative().optional(),
  note: z.string().max(300).nullable().optional(),
});

export const listPantrySchema = z.object({ body: empty, params: empty, query: empty });
export const createPantrySchema = z.object({ body: pantryItemSchema, params: empty, query: empty });
export const updatePantrySchema = z.object({
  body: pantryItemSchema.partial(),
  params: z.object({ id: z.string().cuid() }),
  query: empty,
});
export const deletePantrySchema = z.object({
  body: empty,
  params: z.object({ id: z.string().cuid() }),
  query: empty,
});

export type CreatePantryInput = z.infer<typeof createPantrySchema>["body"];
export type UpdatePantryInput = z.infer<typeof updatePantrySchema>["body"];
export type PantryIdParams = z.infer<typeof updatePantrySchema>["params"];
