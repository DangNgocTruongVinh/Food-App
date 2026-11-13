import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getApiError } from "../../api/client";
import { AdminPager, AdminSearch } from "../../components/admin/AdminListParts";
import { AdminRecipeTable } from "../../components/admin/AdminRecipeTable";
import { ButtonLink, Card, Chip, EmptyState, ErrorState, LoadingState, Skeleton, Toast, useConfirm } from "../../components/ui";
import { type AdminRecipeStatus, type AdminRecipeSummary, listAdminRecipes } from "../../features/admin/admin.api";
import { adminMutations, adminQueries, invalidateAdminRecipeQueries } from "../../features/admin/admin.queries";
import { deleteRecipeConfirmText } from "../../features/admin/admin-recipes.logic";
import { useRemoteOptions } from "../../features/ui/useRemoteOptions";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: Array<[AdminRecipeStatus, string]> = [["all", "Tất cả"], ["visible", "Đang hiện"], ["hidden", "Đã ẩn"], ["deleted", "Đã xóa"]];
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
  // Gợi ý khi gõ: 8 món đầu của cùng bộ lọc trạng thái (tìm không dấu ở máy chủ, searchRecipes).
  const suggestions = useRemoteOptions(
    ["admin", "recipe-suggestions", status], search,
    async (text) => (await listAdminRecipes({ search: text, status, page: 1, pageSize: 8 })).items,
    (recipe) => ({ id: recipe.id, label: recipe.name, detail: recipe.deletedAt ? "Đã xóa" : recipe.hidden ? "Đã ẩn" : recipe.cuisine }),
  );
  const visibility = useMutation({ ...adminMutations.setVisibility(), onSuccess: () => invalidateAdminRecipeQueries(queryClient) });
  const remove = useMutation({ ...adminMutations.deleteRecipe(), onSuccess: () => invalidateAdminRecipeQueries(queryClient) });
  const restore = useMutation({ ...adminMutations.restoreRecipe(), onSuccess: () => invalidateAdminRecipeQueries(queryClient) });

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
    const ok = await confirm({ ...deleteRecipeConfirmText(recipe), confirmLabel: "Xóa món", tone: "danger" });
    if (!ok) return;
    remove.mutate(recipe.id, {
      onSuccess: (result) => setToast(result.mode === "soft" ? `Đã xóa mềm “${recipe.name}”.` : `Đã xóa hẳn “${recipe.name}”.`),
      onError: (error) => setActionError(getApiError(error)),
    });
  };

  // Khôi phục không cần hộp xác nhận: món quay lại như trước khi xóa, xóa lại được.
  const restoreRecipe = (recipe: AdminRecipeSummary) => {
    setActionError("");
    restore.mutate(recipe.id, {
      onSuccess: () => setToast(`Đã khôi phục “${recipe.name}”.`),
      onError: (error) => setActionError(getApiError(error)),
    });
  };

  const data = list.data;
  const pendingId = visibility.isPending ? visibility.variables?.id ?? null
    : remove.isPending ? remove.variables ?? null : restore.isPending ? restore.variables ?? null : null;

  return (
    <section className="ad-section" aria-labelledby="ad-recipes-title">
      <div className="ad-section__head">
        <h2 id="ad-recipes-title" className="ad-section__title">Công thức</h2>
        <ButtonLink variant="primary" icon={<Plus />} to="/admin/recipes/new">Tạo món</ButtonLink>
      </div>
      <div className="ad-toolbar">
        <AdminSearch
          id="ad-recipe-search"
          label="Tìm món, nguyên liệu, ẩm thực"
          value={search}
          onChange={setSearch}
          options={suggestions.options}
          loading={suggestions.loading}
        />
        <div className="ad-filter" role="group" aria-label="Lọc theo trạng thái">
          {STATUS_OPTIONS.map(([value, label]) => (
            <Chip key={value} selected={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</Chip>
          ))}
        </div>
      </div>
      <p className="ui-small">
        Món chưa được dùng thì xóa hẳn. Món đã có trong thực đơn hoặc bài viết thì xóa mềm, khôi phục được ở bộ lọc “Đã xóa”.
      </p>
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
              onRestore={restoreRecipe}
            />
            <AdminPager label="Phân trang công thức" summary={`${data.total} món`} page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </Card>
      <Toast message={toast} onDone={clearToast} />
    </section>
  );
}
