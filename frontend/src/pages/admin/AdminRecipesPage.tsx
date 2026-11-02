import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../../api/client";
import { AdminRecipeTable } from "../../components/admin/AdminRecipeTable";
import { ButtonLink, Card, Chip, EmptyState, ErrorState, IconButton, LoadingState, Skeleton, Toast, useConfirm } from "../../components/ui";
import type { AdminRecipeStatus, AdminRecipeSummary } from "../../features/admin/admin.api";
import { adminMutations, adminQueries, invalidateAdminRecipeQueries } from "../../features/admin/admin.queries";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: Array<[AdminRecipeStatus, string]> = [["all", "Tất cả"], ["visible", "Đang hiện"], ["hidden", "Đã ẩn"]];
type LocationState = { toast?: string } | null;

/** /admin/recipes: tìm, lọc trạng thái, phân trang; Sửa / Ẩn–Hiện / Xóa (Ẩn, Xóa qua ConfirmDialog). */
export default function AdminRecipesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminRecipeStatus>("all");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState((location.state as LocationState)?.toast ?? "");
  const [actionError, setActionError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  // Thông báo từ trang tạo/sửa: hiện một lần rồi xóa khỏi lịch sử để quay lại không hiện lại.
  useEffect(() => {
    if ((location.state as LocationState)?.toast) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);
  // Gõ tìm kiếm: đợi 300ms rồi mới gọi API.
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const list = useQuery(adminQueries.recipes({ search: query, status, page, pageSize: PAGE_SIZE }));
  const visibility = useMutation({ ...adminMutations.setVisibility(), onSuccess: () => invalidateAdminRecipeQueries(queryClient) });
  const remove = useMutation({ ...adminMutations.deleteRecipe(), onSuccess: () => invalidateAdminRecipeQueries(queryClient) });

  const toggleHidden = async (recipe: AdminRecipeSummary) => {
    setActionError("");
    if (!recipe.hidden) {
      const ok = await confirm({
        title: `Ẩn “${recipe.name}”?`,
        description: "Món biến khỏi trang Công thức, không chọn được khi tạo thực đơn hay đăng bài. "
          + "Thực đơn và bài viết cũ vẫn giữ món. Có thể hiện lại bất cứ lúc nào.",
        confirmLabel: "Ẩn món",
      });
      if (!ok) return;
    }
    visibility.mutate({ id: recipe.id, hidden: !recipe.hidden }, {
      onSuccess: () => setToast(recipe.hidden ? `Đã hiện lại “${recipe.name}”.` : `Đã ẩn “${recipe.name}”.`),
      onError: (error) => setActionError(getApiError(error)),
    });
  };
  const deleteRecipe = async (recipe: AdminRecipeSummary) => {
    setActionError("");
    const ok = await confirm({
      title: `Xóa “${recipe.name}”?`,
      description: "Món chưa được dùng ở thực đơn hay bài viết nào. Xóa hẳn cả nguyên liệu, các bước và ảnh đã tải lên. Không hoàn tác được.",
      confirmLabel: "Xóa món",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(recipe.id, {
      onSuccess: () => setToast(`Đã xóa “${recipe.name}”.`),
      onError: (error) => setActionError(getApiError(error)),
    });
  };

  const data = list.data;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const pendingId = visibility.isPending ? visibility.variables?.id ?? null : remove.isPending ? remove.variables ?? null : null;

  return (
    <section className="ad-section" aria-labelledby="ad-recipes-title">
      <div className="ad-section__head">
        <h2 id="ad-recipes-title" className="ad-section__title">Công thức</h2>
        <ButtonLink variant="primary" icon={<Plus />} to="/admin/recipes/new">Tạo món</ButtonLink>
      </div>
      <div className="ad-toolbar">
        <div className="ad-search" role="search">
          <label className="ui-visually-hidden" htmlFor="ad-recipe-search">Tìm món theo tên</label>
          <Search className="ad-search__icon" aria-hidden="true" />
          <input
            id="ad-recipe-search"
            className="ui-input ad-search__input"
            type="search"
            value={search}
            placeholder="Tìm món theo tên"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="ad-filter" role="group" aria-label="Lọc theo trạng thái">
          {STATUS_OPTIONS.map(([value, label]) => (
            <Chip key={value} selected={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</Chip>
          ))}
        </div>
      </div>
      {actionError && <ErrorState message={actionError} />}
      <Card variant="flush" className="ad-panel">
        {list.isLoading ? (
          <LoadingState label="Đang tải công thức">{[0, 1, 2, 3].map((index) => <Skeleton key={index} kind="block" height={64} />)}</LoadingState>
        ) : list.isError || !data ? (
          <ErrorState message="Chưa tải được danh sách công thức." onRetry={() => void list.refetch()} retrying={list.isFetching} />
        ) : !data.items.length ? (
          <EmptyState message={query || status !== "all" ? "Không có món nào khớp với từ khóa và bộ lọc đang chọn." : "Chưa có công thức nào."} />
        ) : (
          <>
            <AdminRecipeTable
              recipes={data.items}
              pendingId={pendingId}
              onToggleHidden={(recipe) => void toggleHidden(recipe)}
              onDelete={(recipe) => void deleteRecipe(recipe)}
            />
            <footer className="ad-pager">
              <p className="ad-pager__count" aria-live="polite">
                {data.total} món, trang {page}/{pageCount}. Món đã dùng trong thực đơn hoặc bài viết chỉ ẩn được, không xóa được.
              </p>
              {pageCount > 1 && (
                <nav className="ad-pager__nav" aria-label="Phân trang công thức">
                  <IconButton quiet label="Trang trước" icon={<ChevronLeft />} disabled={page === 1} onClick={() => setPage(page - 1)} />
                  <IconButton quiet label="Trang sau" icon={<ChevronRight />} disabled={page === pageCount} onClick={() => setPage(page + 1)} />
                </nav>
              )}
            </footer>
          </>
        )}
      </Card>
      <Toast message={toast} onDone={clearToast} />
    </section>
  );
}
