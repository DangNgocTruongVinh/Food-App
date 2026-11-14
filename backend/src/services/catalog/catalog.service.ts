import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { allergyGroups } from "../allergy-groups.js";
import { foodCategories } from "../food-category.js";
import { applyCatalog, type CatalogRows, seedCatalogRows } from "./catalog-build.js";

/**
 * Danh mục nghiệp vụ trong database (dị ứng, nhóm thực phẩm + hạn dùng, viết tắt và từ khóa hóa đơn): đọc một lần khi khởi
 * động, giữ trong bộ nhớ cho các hàm lọc (gọi hàng nghìn lần mỗi lượt gợi ý), đọc lại ngay sau mỗi lần Admin sửa.
 * shortcut: cache trong bộ nhớ một tiến trình; chạy nhiều tiến trình backend thì cần báo nhau làm mới (vd. LISTEN/NOTIFY của PostgreSQL).
 */
type CatalogClient = Pick<PrismaClient,
  "allergenGroup" | "allergenAlias" | "allergenTerm" | "allergenExclusion" | "foodCategory" | "foodCategoryTerm" | "foodShelfLifeRule"
  | "receiptAbbreviation" | "receiptSkipKeyword">;

export async function readCatalogRows(client: CatalogClient = prisma): Promise<CatalogRows> {
  const [groups, categories, abbreviations, keywords] = await Promise.all([
    client.allergenGroup.findMany({ include: { parent: { select: { code: true } }, aliases: true, terms: true, exclusions: true } }),
    client.foodCategory.findMany({ include: { terms: true, shelfLifeRules: true } }),
    client.receiptAbbreviation.findMany(),
    client.receiptSkipKeyword.findMany(),
  ]);
  return {
    allergenGroups: groups.map((group) => ({ ...group, parentCode: group.parent?.code ?? null })),
    foodCategories: categories,
    receiptAbbreviations: abbreviations,
    receiptSkipKeywords: keywords,
  };
}

/** Đọc database và đưa vào bộ nhớ (gọi khi khởi động và sau mỗi lần Admin sửa danh mục). */
export async function loadCatalog(client: CatalogClient = prisma) {
  const rows = await readCatalogRows(client);
  if (!rows.allergenGroups.length || !rows.foodCategories.length) {
    // Không bao giờ chạy với danh mục rỗng: lọc dị ứng sẽ bỏ sót mà không báo.
    throw new Error("Danh mục dữ liệu trong database đang trống. Chạy seed (npm run db:seed) hoặc khởi động lại để tự tạo.");
  }
  applyCatalog(rows);
  return rows;
}

/**
 * Tạo dữ liệu ban đầu cho bảng danh mục CÒN TRỐNG (lần đầu sau migration, hoặc database mới). Bảng đã có dữ liệu thì không đụng
 * (giữ chỉnh sửa của Admin). Trả về số dòng đã tạo theo từng nhóm bảng.
 */
export async function seedCatalog(client: CatalogClient = prisma) {
  const seed = seedCatalogRows();
  const created = { allergenGroups: 0, foodCategories: 0, receiptAbbreviations: 0, receiptSkipKeywords: 0 };
  if (!(await client.allergenGroup.count())) {
    const ids = new Map<string, string>();
    for (const group of seed.allergenGroups) {
      const row = await client.allergenGroup.create({
        data: {
          code: group.code, label: group.label, sortOrder: group.sortOrder,
          aliases: { create: group.aliases.map(({ name, sortOrder }) => ({ name, sortOrder })) },
          terms: { create: group.terms.map(({ name, level, processed, sortOrder }) => ({ name, level, processed, sortOrder })) },
          exclusions: { create: group.exclusions },
        },
        select: { id: true },
      });
      ids.set(group.code, row.id);
    }
    for (const group of seed.allergenGroups.filter((item) => item.parentCode)) {
      await client.allergenGroup.update({ where: { id: ids.get(group.code)! }, data: { parentId: ids.get(group.parentCode!)! } });
    }
    created.allergenGroups = seed.allergenGroups.length;
  }
  if (!(await client.foodCategory.count())) {
    for (const { terms, shelfLifeRules, hiddenAt: _hidden, ...category } of seed.foodCategories) {
      await client.foodCategory.create({ data: { ...category, terms: { create: terms }, shelfLifeRules: { create: shelfLifeRules } } });
    }
    created.foodCategories = seed.foodCategories.length;
  }
  if (!(await client.receiptAbbreviation.count())) {
    await client.receiptAbbreviation.createMany({ data: seed.receiptAbbreviations.map(({ hiddenAt: _hidden, ...row }) => row) });
    created.receiptAbbreviations = seed.receiptAbbreviations.length;
  }
  if (!(await client.receiptSkipKeyword.count())) {
    await client.receiptSkipKeyword.createMany({ data: seed.receiptSkipKeywords });
    created.receiptSkipKeywords = seed.receiptSkipKeywords.length;
  }
  return created;
}

/** Khởi động backend: tạo dữ liệu ban đầu nếu bảng trống (sau migration mới), rồi nạp vào bộ nhớ. */
export async function ensureCatalog(client: CatalogClient = prisma) {
  const created = await seedCatalog(client);
  if (Object.values(created).some(Boolean)) console.log("Đã tạo danh mục dữ liệu ban đầu:", JSON.stringify(created));
  await loadCatalog(client);
}

/**
 * GET /api/catalog: danh mục cho frontend — nhóm dị ứng và nhóm thực phẩm (từ bộ nhớ, đã nạp từ database), các nền ẩm thực
 * đang có trong thư viện món (nhiều món trước) cho ô gợi ý ở Hồ sơ và form món của Admin.
 */
export async function getPublicCatalog() {
  const recipes = await prisma.recipe.findMany({ where: { deletedAt: null, hiddenAt: null }, select: { cuisine: true } });
  const counts = new Map<string, number>();
  for (const { cuisine } of recipes) if (cuisine.trim()) counts.set(cuisine.trim(), (counts.get(cuisine.trim()) ?? 0) + 1);
  return {
    allergenGroups: allergyGroups(),
    foodCategories: foodCategories().map(({ name, defaultStorage, defaultShelfLifeDays }) => ({ name, defaultStorage, defaultShelfLifeDays })),
    cuisines: [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "vi")).map(([cuisine]) => cuisine),
  };
}
