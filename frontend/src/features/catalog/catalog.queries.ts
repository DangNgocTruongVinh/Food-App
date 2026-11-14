import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "../../api/client";
import type { StorageLocation } from "../../types";
import { type AllergyGroup, setAllergyCatalog } from "../profile/allergy-groups";

/**
 * Danh mục dữ liệu (nhóm dị ứng, nhóm thực phẩm) đọc từ GET /api/catalog — backend đọc từ database. Không có bản chép tay ở
 * frontend: gợi ý ô Dị ứng/Món không thích, nhóm Kho và danh sách đi chợ đều dùng bản này.
 */
export type FoodCategoryInfo = { name: string; defaultStorage: StorageLocation; defaultShelfLifeDays: number | null };
/** cuisines: nền ẩm thực đang có trong thư viện món (nhiều món trước). */
export type Catalog = { allergenGroups: AllergyGroup[]; foodCategories: FoodCategoryInfo[]; cuisines: string[] };

export async function getCatalog() {
  const catalog = (await api.get<Catalog>("/catalog")).data;
  // Logic nhóm dị ứng dùng chung (allergy-groups.ts) đọc danh mục từ kho trong bộ nhớ.
  setAllergyCatalog(catalog.allergenGroups);
  return catalog;
}

export const catalogQuery = queryOptions({ queryKey: ["catalog"] as const, queryFn: getCatalog, staleTime: 5 * 60_000 });

/** Danh mục đã tải (data) thì các hàm của allergy-groups.ts dùng được. Admin sửa danh mục thì làm mới khóa ["catalog"]. */
export const useCatalog = () => useQuery(catalogQuery);

/** Tên nhóm thực phẩm theo thứ tự hiển thị (rỗng khi chưa tải). */
export const useFoodCategoryNames = () => useCatalog().data?.foodCategories.map((category) => category.name) ?? [];

/** Gợi ý ô ẩm thực (Hồ sơ, form món của Admin) từ các món đang có. */
export function useCuisineOptions() {
  const cuisines = useCatalog().data?.cuisines;
  return useMemo(() => {
    const names = cuisines ?? [];
    return { names, options: names.map((label) => ({ id: label, label, detail: "Ẩm thực" })) };
  }, [cuisines]);
}
