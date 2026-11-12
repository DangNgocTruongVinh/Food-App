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
  /** Đơn giá (đồng / 1 đơn vị), tùy chọn. */
  unitPrice: z.number().nonnegative().max(1_000_000_000).nullable().optional(),
});

export const listPantrySchema = z.object({ body: empty, params: empty, query: empty });
export const createPantrySchema = z.object({ body: pantryItemSchema, params: empty, query: empty });
export const updatePantrySchema = z.object({
  body: pantryItemSchema.partial(),
  params: z.object({ id: z.string().cuid() }),
  query: empty,
});
export const PANTRY_REMOVAL_REASONS = ["USED_UP", "DISCARDED", "MISTAKE"] as const;
/** DELETE /api/pantry/:id?reason=…: lý do bắt buộc (Báo cáo lãng phí; MISTAKE không tính vào thống kê). */
export const deletePantrySchema = z.object({
  body: empty,
  params: z.object({ id: z.string().cuid() }),
  query: z.object({ reason: z.enum(PANTRY_REMOVAL_REASONS) }),
});

export const PANTRY_TRANSACTION_SOURCES = ["CONSUMPTION", "PURCHASE", "MANUAL_ADD", "MANUAL_EDIT", "MANUAL_DELETE", "RECEIPT_SCAN"] as const;

export const listPantryTransactionsSchema = z.object({
  body: empty,
  params: empty,
  query: z.object({
    source: z.enum(PANTRY_TRANSACTION_SOURCES).optional(),
    pantryItemId: z.string().cuid().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export type CreatePantryInput = z.infer<typeof createPantrySchema>["body"];
export type UpdatePantryInput = z.infer<typeof updatePantrySchema>["body"];
export type PantryIdParams = z.infer<typeof updatePantrySchema>["params"];
export type PantryRemovalReasonInput = (typeof PANTRY_REMOVAL_REASONS)[number];
export type PantryTransactionsQuery = z.infer<typeof listPantryTransactionsSchema>["query"];
