import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { getApiError } from "../../api/client";
import { AdminAllergenCatalog } from "../../components/admin/AdminAllergenCatalog";
import { AdminFoodCatalog, AdminReceiptCatalog } from "../../components/admin/AdminFoodCatalog";
import { ChoiceGroup, ErrorState, LoadingState, Skeleton, Toast } from "../../components/ui";
import type { CatalogSaveInput } from "../../features/admin/admin.api";
import { adminMutations, adminQueries } from "../../features/admin/admin.queries";
import { catalogQuery } from "../../features/catalog/catalog.queries";

/** Lưu một mục; true = thành công (form tự xóa ô nhập). Lỗi máy chủ hiện ở đầu trang. */
export type SaveCatalog = (input: CatalogSaveInput, done: string) => Promise<boolean>;

const TABS = [["allergens", "Nhóm dị ứng"], ["food", "Nhóm thực phẩm"], ["receipt", "Viết tắt hóa đơn"]] as const;
type Tab = (typeof TABS)[number][0];

/**
 * /admin/catalog: dữ liệu nghiệp vụ lưu trong database — nhóm dị ứng (tên gọi khác, nguyên liệu thuộc nhóm), nhóm thực phẩm
 * và hạn dùng ước tính, viết tắt trên hóa đơn. Không xóa, chỉ ẩn/hiện. Lưu xong backend nạp lại danh mục, bộ lọc dùng ngay.
 */
export default function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("allergens");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const catalog = useQuery(adminQueries.catalog());
  const mutation = useMutation({
    ...adminMutations.saveCatalogEntry(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.catalog().queryKey });
      void queryClient.invalidateQueries({ queryKey: catalogQuery.queryKey });
    },
  });

  const save: SaveCatalog = (input, done) => new Promise((resolve) => {
    setError("");
    mutation.mutate(input, {
      onSuccess: () => { setToast(done); resolve(true); },
      onError: (reason) => { setError(`Chưa lưu được: ${getApiError(reason)}`); resolve(false); },
    });
  });

  const data = catalog.data;
  const busy = mutation.isPending;
  return (
    <section className="ad-section" aria-labelledby="ad-catalog-title">
      <h2 id="ad-catalog-title" className="ad-section__title">Danh mục dữ liệu</h2>
      <p className="ad-section__lead">
        Dữ liệu bộ lọc dị ứng, nhóm Kho và đọc hóa đơn dùng. Sửa ở đây có hiệu lực ngay; mục không dùng nữa thì ẩn (không xóa).
      </p>
      <ChoiceGroup legend="Loại danh mục" name="ad-catalog-tab" options={TABS} value={tab} onChange={(value) => setTab(value as Tab)} />
      {error && <ErrorState message={error} />}
      {catalog.isLoading ? (
        <LoadingState label="Đang tải danh mục">{[0, 1, 2].map((index) => <Skeleton key={index} kind="block" height={96} />)}</LoadingState>
      ) : catalog.isError || !data ? (
        <ErrorState message="Chưa tải được danh mục dữ liệu." onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} />
      ) : tab === "allergens" ? (
        <AdminAllergenCatalog groups={data.allergenGroups} save={save} busy={busy} />
      ) : tab === "food" ? (
        <AdminFoodCatalog categories={data.foodCategories} save={save} busy={busy} />
      ) : (
        <AdminReceiptCatalog abbreviations={data.receiptAbbreviations} save={save} busy={busy} />
      )}
      <Toast message={toast} onDone={clearToast} />
    </section>
  );
}
