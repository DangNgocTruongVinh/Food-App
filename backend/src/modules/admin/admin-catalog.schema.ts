import { z } from "zod";

const empty = z.object({});
const id = z.string().cuid();
const name = z.string().trim().min(1, "Không được để trống.").max(80);
const hidden = z.boolean().optional();
const storage = z.enum(["REFRIGERATOR", "FREEZER", "DRY_STORAGE"]);
/** null = không đặt hạn (vd. nhóm "Khác"). */
const shelfLifeDays = z.number().int().min(1).max(3650).nullable();
const level = z.enum(["CONTAINS", "MAY_CONTAIN"]);
const atLeastOne = (value: object) => Object.values(value).some((field) => field !== undefined);

/** Loại mục Admin quản lý ở trang "Danh mục dữ liệu" (đường dẫn /api/admin/catalog/:kind). */
export const CATALOG_KINDS = ["allergen-groups", "allergen-aliases", "allergen-terms", "food-categories", "receipt-abbreviations"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

const createBodies = {
  "allergen-groups": z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,39}$/, "Mã viết hoa không dấu, vd. CELERY."),
    label: name,
    parentId: id.nullable().default(null),
  }),
  "allergen-aliases": z.object({ groupId: id, name }),
  "allergen-terms": z.object({ groupId: id, name, level: level.default("CONTAINS"), processed: z.boolean().default(false) }),
  "food-categories": z.object({ name, defaultStorage: storage, defaultShelfLifeDays: shelfLifeDays }),
  "receipt-abbreviations": z.object({ abbreviation: z.string().trim().min(1).max(60), fullName: name }),
};

const updateBodies = {
  "allergen-groups": z.object({ label: name.optional(), parentId: id.nullable().optional(), hidden }),
  "allergen-aliases": z.object({ name: name.optional(), hidden }),
  "allergen-terms": z.object({ name: name.optional(), level: level.optional(), processed: z.boolean().optional(), hidden }),
  "food-categories": z.object({ name: name.optional(), defaultStorage: storage.optional(), defaultShelfLifeDays: shelfLifeDays.optional(), hidden }),
  "receipt-abbreviations": z.object({ abbreviation: z.string().trim().min(1).max(60).optional(), fullName: name.optional(), hidden }),
};

type Bodies<T extends Record<CatalogKind, z.ZodTypeAny>> = { [K in CatalogKind]: { kind: K } & z.infer<T[K]> }[CatalogKind];
export type CatalogCreateInput = Bodies<typeof createBodies>;
export type CatalogUpdateInput = Bodies<typeof updateBodies>;

const byKind = <T extends Record<CatalogKind, z.AnyZodObject>>(bodies: T, withId: boolean) =>
  z.union(CATALOG_KINDS.map((kind) => z.object({
    body: withId ? bodies[kind].refine(atLeastOne, "Chưa có thay đổi nào.") : bodies[kind],
    params: withId ? z.object({ kind: z.literal(kind), id }) : z.object({ kind: z.literal(kind) }),
    query: empty,
  })) as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);

export const listCatalogSchema = z.object({ body: empty, params: empty, query: empty });
export const createCatalogSchema = byKind(createBodies, false);
export const updateCatalogSchema = byKind(updateBodies, true);
