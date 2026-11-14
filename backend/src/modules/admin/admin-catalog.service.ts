import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { loadCatalog } from "../../services/catalog/catalog.service.js";
import { foldText } from "../../services/receipt/receipt-text.js";
import { HttpError } from "../../utils/http-error.js";
import { recordAdminAction } from "./admin-audit.service.js";
import type { CatalogCreateInput, CatalogKind, CatalogUpdateInput } from "./admin-catalog.schema.js";

/**
 * Admin quản lý danh mục dữ liệu. Không xóa hẳn, chỉ ẩn (hiddenAt) để giữ lịch sử và khôi phục được. Mỗi thao tác ghi nhật ký
 * Admin trong cùng transaction; xong thì nạp lại danh mục vào bộ nhớ ngay (lọc dị ứng, nhóm Kho, đọc hóa đơn dùng bản mới).
 */
type Tx = Prisma.TransactionClient;
type Saved = { id: string; label: string };

/** Toàn bộ danh mục (kể cả mục đã ẩn) cho trang Admin. */
export async function listCatalogForAdmin() {
  const sort = { sortOrder: "asc" } as const;
  const [allergenGroups, foodCategories, receiptAbbreviations] = await Promise.all([
    prisma.allergenGroup.findMany({
      orderBy: sort,
      include: { aliases: { orderBy: sort }, terms: { orderBy: [{ level: "asc" }, sort] }, exclusions: { orderBy: { phrase: "asc" } } },
    }),
    prisma.foodCategory.findMany({ orderBy: sort, include: { shelfLifeRules: { orderBy: { priority: "asc" } } } }),
    prisma.receiptAbbreviation.findMany({ orderBy: sort }),
  ]);
  return { allergenGroups, foodCategories, receiptAbbreviations };
}

const hiddenAt = (hidden: boolean | undefined, current: Date | null) => (hidden === undefined ? undefined : hidden ? current ?? new Date() : null);
const changedFields = (input: object, current: Record<string, unknown>) => Object.entries(input)
  .filter(([field, value]) => field !== "kind" && value !== undefined
    && (field === "hidden" ? (current.hiddenAt !== null) !== value : current[field] !== value))
  .map(([field]) => field);
const notFound = () => new HttpError(404, "Không tìm thấy mục trong danh mục.");
/** Tên viết tắt so trên chữ đã bỏ dấu, chữ thường (như bộ đọc hóa đơn). */
const abbreviationKey = (value: string) => foldText(value);

async function checkParent(tx: Tx, groupId: string | null, parentId: string | null | undefined) {
  if (!parentId) return;
  if (parentId === groupId) throw new HttpError(400, "Nhóm không thể là nhóm cha của chính nó.");
  const parent = await tx.allergenGroup.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new HttpError(400, "Không tìm thấy nhóm cha.");
  if (parent.parentId) throw new HttpError(400, "Nhóm cha phải là nhóm gốc (chỉ một tầng, như Hải sản → Cá).");
  if (groupId && (await tx.allergenGroup.count({ where: { parentId: groupId } }))) {
    throw new HttpError(400, "Nhóm đang có nhóm con nên không thể làm nhóm con.");
  }
}

async function createRow(tx: Tx, input: CatalogCreateInput): Promise<Saved> {
  switch (input.kind) {
    case "allergen-groups": {
      await checkParent(tx, null, input.parentId);
      const sortOrder = await tx.allergenGroup.count();
      const row = await tx.allergenGroup.create({ data: { code: input.code, label: input.label, parentId: input.parentId, sortOrder } });
      return { id: row.id, label: row.label };
    }
    case "allergen-aliases": {
      const sortOrder = await tx.allergenAlias.count({ where: { groupId: input.groupId } });
      const row = await tx.allergenAlias.create({ data: { groupId: input.groupId, name: input.name, sortOrder } });
      return { id: row.id, label: row.name };
    }
    case "allergen-terms": {
      const sortOrder = await tx.allergenTerm.count({ where: { groupId: input.groupId } });
      const row = await tx.allergenTerm.create({
        data: { groupId: input.groupId, name: input.name, level: input.level, processed: input.processed, sortOrder },
      });
      return { id: row.id, label: row.name };
    }
    case "food-categories": {
      // Nhóm mới đứng trước nhóm mặc định ("Khác" luôn cuối).
      const fallback = await tx.foodCategory.findFirst({ where: { isFallback: true }, select: { id: true, sortOrder: true } });
      const sortOrder = fallback?.sortOrder ?? (await tx.foodCategory.count());
      if (fallback) await tx.foodCategory.update({ where: { id: fallback.id }, data: { sortOrder: sortOrder + 1 } });
      const { kind: _kind, ...data } = input;
      const row = await tx.foodCategory.create({ data: { ...data, sortOrder } });
      return { id: row.id, label: row.name };
    }
    case "receipt-abbreviations": {
      const sortOrder = await tx.receiptAbbreviation.count();
      const row = await tx.receiptAbbreviation.create({
        data: { abbreviation: abbreviationKey(input.abbreviation), fullName: input.fullName, sortOrder },
      });
      return { id: row.id, label: `${row.abbreviation} → ${row.fullName}` };
    }
  }
}

async function updateRow(tx: Tx, id: string, input: CatalogUpdateInput): Promise<Saved & { changedFields: string[] }> {
  switch (input.kind) {
    case "allergen-groups": {
      const current = await tx.allergenGroup.findUnique({ where: { id } });
      if (!current) throw notFound();
      if (input.parentId !== undefined) await checkParent(tx, id, input.parentId);
      const row = await tx.allergenGroup.update({
        where: { id }, data: { label: input.label, parentId: input.parentId, hiddenAt: hiddenAt(input.hidden, current.hiddenAt) },
      });
      // Hồ sơ người dùng lưu tên nhóm ("Trứng"): đổi tên thì giữ tên cũ làm tên gọi khác để hồ sơ cũ vẫn nhận ra cả nhóm.
      if (input.label && input.label !== current.label) {
        await tx.allergenAlias.upsert({
          where: { groupId_name: { groupId: id, name: current.label } },
          create: { groupId: id, name: current.label, sortOrder: await tx.allergenAlias.count({ where: { groupId: id } }) },
          update: { hiddenAt: null },
        });
      }
      return { id, label: row.label, changedFields: changedFields(input, current) };
    }
    case "allergen-aliases": {
      const current = await tx.allergenAlias.findUnique({ where: { id } });
      if (!current) throw notFound();
      const row = await tx.allergenAlias.update({ where: { id }, data: { name: input.name, hiddenAt: hiddenAt(input.hidden, current.hiddenAt) } });
      return { id, label: row.name, changedFields: changedFields(input, current) };
    }
    case "allergen-terms": {
      const current = await tx.allergenTerm.findUnique({ where: { id } });
      if (!current) throw notFound();
      const row = await tx.allergenTerm.update({
        where: { id },
        data: { name: input.name, level: input.level, processed: input.processed, hiddenAt: hiddenAt(input.hidden, current.hiddenAt) },
      });
      return { id, label: row.name, changedFields: changedFields(input, current) };
    }
    case "food-categories": {
      const current = await tx.foodCategory.findUnique({ where: { id } });
      if (!current) throw notFound();
      if (input.hidden && current.isFallback) throw new HttpError(400, "Không thể ẩn nhóm mặc định (dùng khi không nhận ra nhóm).");
      const row = await tx.foodCategory.update({
        where: { id },
        data: {
          name: input.name, defaultStorage: input.defaultStorage, defaultShelfLifeDays: input.defaultShelfLifeDays,
          hiddenAt: hiddenAt(input.hidden, current.hiddenAt),
        },
      });
      // Kho và danh sách đi chợ lưu tên nhóm: đổi tên thì đổi theo. Lịch sử kho (PantryTransaction) giữ tên lúc ghi.
      if (input.name && input.name !== current.name) {
        await tx.pantryItem.updateMany({ where: { category: current.name }, data: { category: input.name } });
        await tx.shoppingItem.updateMany({ where: { category: current.name }, data: { category: input.name } });
      }
      return { id, label: row.name, changedFields: changedFields(input, current) };
    }
    case "receipt-abbreviations": {
      const current = await tx.receiptAbbreviation.findUnique({ where: { id } });
      if (!current) throw notFound();
      const abbreviation = input.abbreviation === undefined ? undefined : abbreviationKey(input.abbreviation);
      const row = await tx.receiptAbbreviation.update({
        where: { id }, data: { abbreviation, fullName: input.fullName, hiddenAt: hiddenAt(input.hidden, current.hiddenAt) },
      });
      return { id, label: `${row.abbreviation} → ${row.fullName}`, changedFields: changedFields({ ...input, abbreviation }, current) };
    }
  }
}

function conflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new HttpError(409, "Đã có mục trùng tên trong danh mục.");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") throw new HttpError(400, "Không tìm thấy nhóm.");
  throw error;
}

export async function createCatalogEntry(actorId: string, input: CatalogCreateInput) {
  const saved = await prisma.$transaction(async (tx) => {
    const row = await createRow(tx, input);
    await recordAdminAction(tx, {
      actorId, action: "CATALOG_CREATE", targetType: "CATALOG", targetId: row.id, targetLabel: row.label, details: { kind: input.kind },
    });
    return row;
  }).catch(conflict);
  await loadCatalog();
  return saved;
}

export async function updateCatalogEntry(actorId: string, id: string, input: CatalogUpdateInput) {
  const saved = await prisma.$transaction(async (tx) => {
    const row = await updateRow(tx, id, input);
    if (row.changedFields.length) {
      await recordAdminAction(tx, {
        actorId, action: "CATALOG_UPDATE", targetType: "CATALOG", targetId: id, targetLabel: row.label,
        details: { kind: input.kind as CatalogKind, changedFields: row.changedFields },
      });
    }
    return row;
  }).catch(conflict);
  await loadCatalog();
  return saved;
}
