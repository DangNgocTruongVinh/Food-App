import type { Catalog } from "../features/catalog/catalog.queries";

/**
 * Chỉ cho test: danh mục giống hệt GET /api/catalog trên database vừa seed — dựng từ dữ liệu seed của backend
 * (backend/prisma/catalog-data.ts) qua cùng hàm dựng backend dùng khi đọc database. Không phải bản chép tay.
 * Đường dẫn để trong biến: tsc của frontend (và bản build Docker, không có mã backend) không đọc sang mã backend.
 */
type Rows = { allergenGroups: unknown; foodCategories: unknown };
type CatalogBuild = {
  seedCatalogRows: () => Rows;
  buildAllergyGroups: (rows: Rows["allergenGroups"]) => Catalog["allergenGroups"];
  buildFoodCatalog: (rows: Rows["foodCategories"]) => { categories: Array<Catalog["foodCategories"][number] & { isFallback: boolean }> };
};
const BACKEND_CATALOG_BUILD = "../../../backend/src/services/catalog/catalog-build";
const build = (await import(/* @vite-ignore */ BACKEND_CATALOG_BUILD)) as CatalogBuild;

const rows = build.seedCatalogRows();
export const SEED_CATALOG: Catalog = {
  allergenGroups: build.buildAllergyGroups(rows.allergenGroups),
  foodCategories: build.buildFoodCatalog(rows.foodCategories).categories
    .map(({ name, defaultStorage, defaultShelfLifeDays }) => ({ name, defaultStorage, defaultShelfLifeDays })),
  cuisines: ["Việt Nam", "Nhật Bản", "Hàn Quốc", "Thái Lan", "Ý", "Hy Lạp", "Mỹ"],
};
export const SEED_FOOD_CATEGORIES = SEED_CATALOG.foodCategories.map((category) => category.name);
