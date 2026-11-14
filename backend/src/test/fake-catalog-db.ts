import { Prisma } from "@prisma/client";

/**
 * Database giả trong bộ nhớ cho các bảng danh mục (đủ các lệnh Prisma mà catalog.service và admin-catalog.service dùng):
 * test tích hợp seed → nạp danh mục → Admin sửa → lọc dùng bản mới, không cần PostgreSQL. Có kiểm khóa duy nhất (P2002)
 * như database thật; where chỉ hỗ trợ so bằng.
 */
type Row = Record<string, unknown> & { id: string };
type Table = { rows: Row[]; unique: string[][]; defaults: Record<string, unknown>; children?: Record<string, [string, string]> };

export function fakeCatalogDb() {
  let next = 0;
  const table = (unique: string[][], defaults: Record<string, unknown> = {}, children?: Table["children"]): Table =>
    ({ rows: [], unique, defaults: { hiddenAt: null, ...defaults }, children });
  const tables: Record<string, Table> = {
    allergenGroup: table([["code"], ["label"]], { parentId: null },
      { aliases: ["allergenAlias", "groupId"], terms: ["allergenTerm", "groupId"], exclusions: ["allergenExclusion", "groupId"] }),
    allergenAlias: table([["groupId", "name"]]),
    allergenTerm: table([["groupId", "name", "level"]], { level: "CONTAINS", processed: false }),
    allergenExclusion: table([["groupId", "phrase"]]),
    foodCategory: table([["name"]], { isFallback: false, defaultShelfLifeDays: null },
      { terms: ["foodCategoryTerm", "categoryId"], shelfLifeRules: ["foodShelfLifeRule", "categoryId"] }),
    foodCategoryTerm: table([["categoryId", "prefix"]]),
    foodShelfLifeRule: table([["categoryId", "pattern", "matchMode"]]),
    receiptAbbreviation: table([["abbreviation"]]),
    receiptSkipKeyword: table([["reason", "keyword", "matchMode"]]),
    adminAuditLog: table([]),
    recipe: table([], { deletedAt: null }),
    pantryItem: table([]),
    shoppingItem: table([]),
  };

  const matches = (row: Row, where: Record<string, unknown> = {}) => Object.entries(where).every(([key, value]) =>
    value && typeof value === "object" && !(value instanceof Date)
      ? Object.entries(value).every(([field, expected]) => row[field] === expected) // khóa ghép: { groupId_name: {...} }
      : row[key] === value);
  const checkUnique = (name: string, row: Row) => {
    for (const fields of tables[name].unique) {
      if (tables[name].rows.some((other) => other.id !== row.id && fields.every((field) => other[field] === row[field]))) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
      }
    }
  };
  const withRelations = (name: string, row: Row, include?: Record<string, unknown>) => {
    if (!include) return { ...row };
    const out: Record<string, unknown> = { ...row };
    for (const relation of Object.keys(include)) {
      if (relation === "parent") {
        const parent = tables.allergenGroup.rows.find((group) => group.id === row.parentId);
        out.parent = parent ? { code: parent.code } : null;
      } else {
        const [child, key] = tables[name].children![relation];
        out[relation] = tables[child].rows.filter((item) => item[key] === row.id).map((item) => ({ ...item }));
      }
    }
    return out;
  };
  const insert = (name: string, data: Record<string, unknown>) => {
    const nested = Object.entries(data).filter(([, value]) => value && typeof value === "object" && "create" in (value as object));
    const plain = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== undefined && !nested.some(([n]) => n === key)));
    const row: Row = { ...tables[name].defaults, ...plain, id: `cm${String(++next).padStart(23, "0")}`, createdAt: new Date(), updatedAt: new Date() };
    checkUnique(name, row);
    tables[name].rows.push(row);
    for (const [relation, value] of nested) {
      const [child, key] = tables[name].children![relation];
      for (const item of (value as { create: Record<string, unknown>[] }).create) insert(child, { ...item, [key]: row.id });
    }
    return row;
  };
  const patch = (name: string, row: Row, data: Record<string, unknown>) => {
    const updated = { ...row, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), updatedAt: new Date() };
    checkUnique(name, updated);
    Object.assign(row, updated);
    return { ...row };
  };
  const one = (name: string, where: Record<string, unknown>) => tables[name].rows.find((row) => matches(row, where)) ?? null;

  const delegate = (name: string) => ({
    findMany: async (args: { where?: Record<string, unknown>; include?: Record<string, unknown> } = {}) =>
      tables[name].rows.filter((row) => matches(row, args.where)).map((row) => withRelations(name, row, args.include)),
    findUnique: async ({ where }: { where: Record<string, unknown> }) => { const row = one(name, where); return row && { ...row }; },
    findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => { const row = one(name, where ?? {}); return row && { ...row }; },
    count: async ({ where }: { where?: Record<string, unknown> } = {}) => tables[name].rows.filter((row) => matches(row, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => ({ ...insert(name, data) }),
    createMany: async ({ data }: { data: Record<string, unknown>[] }) => ({ count: data.map((item) => insert(name, item)).length }),
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = one(name, where);
      if (!row) throw new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "test" });
      return patch(name, row, data);
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) =>
      ({ count: tables[name].rows.filter((row) => matches(row, where)).map((row) => patch(name, row, data)).length }),
    upsert: async ({ where, create, update }: { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }) => {
      const row = one(name, where);
      return row ? patch(name, row, update) : { ...insert(name, create) };
    },
  });

  const db = Object.fromEntries(Object.keys(tables).map((name) => [name, delegate(name)])) as Record<string, ReturnType<typeof delegate>>;
  return Object.assign(db, {
    // shortcut: không hoàn tác khi lỗi giữa chừng (test chỉ kiểm lỗi xảy ra trước lệnh ghi đầu tiên).
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation(db),
    rows: (name: string) => tables[name].rows,
  });
}
