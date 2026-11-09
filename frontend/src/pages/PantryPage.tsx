import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../api/client";
import { PantryCategoryChips, PantryToolbar } from "../components/pantry/PantryFilterBar";
import { PantryHero } from "../components/pantry/PantryHero";
import { PantryHistorySection } from "../components/pantry/PantryHistory";
import { PantryItemDialog } from "../components/pantry/PantryItemDialog";
import { PantryGrid, PantryTable } from "../components/pantry/PantryItems";
import { PantryPager } from "../components/pantry/PantryPager";
import { PantryCookIdeas, PantrySoonCard, PantrySuggestDialog } from "../components/pantry/PantrySide";
import { PantrySkeleton } from "../components/pantry/PantrySkeleton";
import { ReceiptScanDialog } from "../components/pantry/ReceiptScanDialog";
import { PantryStats } from "../components/pantry/PantryStats";
import { Button, Card, EmptyState, ErrorState, Toast, useConfirm } from "../components/ui";
import {
  activeStatFilter, applyStatFilter, filterAndSortPantry, itemsToUseSoon, PANTRY_PAGE_SIZE, pantryCategories, pantryCounts, pantryDoneMessage,
  type PantryStatusFilter, type PantryView,
} from "../features/pantry/pantry.logic";
import { invalidatePantryQueries, pantryMutations, pantryQueries } from "../features/pantry/pantry.queries";
import { undoReceiptScan } from "../features/pantry/receipt-scan.api";
import { commitMessage, undoMessage } from "../features/pantry/receipt-scan.logic";
import { usePantryItemFocus } from "../features/pantry/usePantryItemFocus";
import type { PantryItem, ReceiptCommitResult, StorageLocation } from "../types";

type DialogState = { item: PantryItem | null } | null;

// "Gợi ý món" trên dòng sắp hết hạn (GĐ3b) chưa hiện. "Quét hóa đơn" (GĐ3c): nút ở đầu trang, hoặc mở từ Tổng quan bằng ?scan=1.
export default function PantryPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PantryStatusFilter>("all");
  const [lowStock, setLowStock] = useState(false);
  const [category, setCategory] = useState("all");
  const [storage, setStorage] = useState<StorageLocation | "all">("all");
  const [sortBy, setSortBy] = useState("expiry");
  const [view, setView] = useState<PantryView>("list");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [suggestFor, setSuggestFor] = useState<PantryItem | null>(null);
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scanOpen, setScanOpen] = useState(() => searchParams.get("scan") === "1");
  const [savedScan, setSavedScan] = useState<ReceiptCommitResult | null>(null);
  // ?scan=1 (nút "Quét hóa đơn" ở Tổng quan): mở hộp quét một lần rồi bỏ tham số khỏi URL.
  useEffect(() => {
    if (searchParams.get("scan") !== "1") return;
    setScanOpen(true);
    setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("scan"); return next; }, { replace: true });
  }, [searchParams, setSearchParams]);

  const list = useQuery(pantryQueries.list());
  const data = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => pantryCounts(data), [data]);
  const categories = useMemo(() => pantryCategories(data), [data]);
  const soon = useMemo(() => itemsToUseSoon(data), [data]);
  const filtered = useMemo(
    () => filterAndSortPantry(data, { search, status, category, storage, sortBy, lowStock }),
    [category, data, lowStock, search, sortBy, status, storage],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PANTRY_PAGE_SIZE));
  const visibleItems = useMemo(() => filtered.slice((page - 1) * PANTRY_PAGE_SIZE, page * PANTRY_PAGE_SIZE), [filtered, page]);

  const clearFilters = useCallback(() => {
    setSearch(""); setStatus("all"); setLowStock(false); setCategory("all"); setStorage("all");
  }, []);
  useEffect(() => setPage(1), [category, lowStock, search, sortBy, status, storage]);
  const focus = usePantryItemFocus({ items: data, ready: list.isSuccess, filtered, visibleItems, clearFilters, setPage });
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const remove = useMutation({
    ...pantryMutations.remove(),
    onSuccess: () => invalidatePantryQueries(queryClient),
  });
  const undoScan = useMutation({
    mutationFn: undoReceiptScan,
    onSuccess: (result) => {
      invalidatePantryQueries(queryClient);
      setSavedScan((current) => (current?.id === result.id ? null : current));
      setToast(undoMessage(result));
    },
  });
  const confirmUndoScan = async (scanId: string) => {
    const confirmed = await confirm({
      title: "Hoàn tác cả hóa đơn?",
      description: "Thực phẩm tạo mới từ hóa đơn sẽ bị xóa; phần cộng vào thực phẩm có sẵn sẽ được trừ lại (phần đã dùng thì không trừ được).",
      confirmLabel: "Hoàn tác hóa đơn",
      tone: "danger",
    });
    if (confirmed) undoScan.mutate(scanId);
  };

  const confirmRemove = async (item: PantryItem) => {
    const confirmed = await confirm({
      title: `Xóa “${item.name}” khỏi kho?`,
      description: "Thực phẩm sẽ không còn trong danh sách và Nouri thôi nhắc hạn sử dụng của nó. Không hoàn tác được.",
      confirmLabel: "Xóa thực phẩm",
      tone: "danger",
    });
    if (!confirmed) return;
    remove.mutate(item.id, { onSuccess: () => setToast(pantryDoneMessage("delete", item.name)) });
  };

  if (list.isLoading) return <PantrySkeleton />;
  if (list.isError) {
    return (
      <div className="kho-view">
        <ErrorState message="Chưa tải được kho thực phẩm." onRetry={() => void list.refetch()} retrying={list.isFetching} />
      </div>
    );
  }

  const selectStat = (stat: Parameters<typeof applyStatFilter>[0]) => {
    const next = applyStatFilter(stat, { status, lowStock });
    setStatus(next.status); setLowStock(next.lowStock);
  };
  const itemProps = {
    items: visibleItems,
    focusedItemId: focus.focusedItemId,
    deletingId: remove.isPending ? remove.variables ?? null : null,
    onEdit: (item: PantryItem) => setDialog({ item }),
    onDelete: (item: PantryItem) => void confirmRemove(item),
    onSuggest: (item: PantryItem) => setSuggestFor(item),
  };

  return (
    <div className="kho-view">
      <PantryHero search={search} onSearchChange={setSearch} onAdd={() => setDialog({ item: null })} onScan={() => setScanOpen(true)} />

      {savedScan && (
        <div className="ui-notice" role="status">
          <span>{commitMessage(savedScan)}</span>
          <span className="kho-notice__actions">
            <Button busy={undoScan.isPending} onClick={() => undoScan.mutate(savedScan.id)}>Hoàn tác</Button>
            <Button onClick={() => setSavedScan(null)}>Đóng</Button>
          </span>
        </div>
      )}
      {undoScan.isError && <ErrorState message={`Chưa hoàn tác được hóa đơn: ${getApiError(undoScan.error)}`} />}

      {focus.focusMissing && (
        <p className="ui-notice" role="status">
          <span>Thực phẩm này không còn trong kho.</span>
          <Button onClick={focus.dismissMissing}>Đóng</Button>
        </p>
      )}
      {remove.isError && <ErrorState message={`Chưa xóa được thực phẩm: ${getApiError(remove.error)}`} />}

      <PantryStats counts={counts} active={activeStatFilter({ status, lowStock })} onSelect={selectStat} />

      <div className="kho-layout">
        <section className="kho-main" aria-labelledby="kho-list-title">
          <h2 id="kho-list-title" className="ui-visually-hidden">Danh sách thực phẩm</h2>
          {/* Chip lọc danh sách: đếm mọi thực phẩm đang hiện (kể cả đã dùng hết); ô thống kê "Tất cả" thì không đếm món đã dùng hết. */}
          <PantryCategoryChips total={data.length} categories={categories} category={category} onChange={setCategory} />
          <Card variant="flush" className="kho-panel">
            <PantryToolbar
              status={status} storage={storage} sortBy={sortBy} view={view}
              onStatusChange={setStatus} onStorageChange={setStorage} onSortChange={setSortBy} onViewChange={setView}
            />
            {!data.length ? (
              <EmptyState
                message="Kho chưa có thực phẩm nào."
                action={<Button variant="primary" onClick={() => setDialog({ item: null })}>Thêm thực phẩm</Button>}
              />
            ) : !filtered.length ? (
              <EmptyState
                message="Không có thực phẩm nào khớp với từ khóa và bộ lọc đang chọn."
                action={<Button onClick={clearFilters}>Xóa bộ lọc</Button>}
              />
            ) : (
              <>
                {view === "list" ? <PantryTable {...itemProps} /> : <PantryGrid {...itemProps} />}
                <PantryPager page={page} pageCount={pageCount} pageSize={PANTRY_PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
              </>
            )}
          </Card>
        </section>

        <aside className="kho-side" aria-label="Gợi ý từ kho">
          <PantrySoonCard
            expiring={soon.expiring}
            expired={soon.expired}
            onOpen={(item) => focus.focusItem(item.id)}
            onShowAll={(next) => { clearFilters(); setStatus(next); }}
          />
          <PantryCookIdeas />
        </aside>

        <PantryHistorySection
          receiptUndo={{ onUndo: (scanId) => void confirmUndoScan(scanId), undoingScanId: undoScan.isPending ? undoScan.variables ?? null : null }}
        />
      </div>

      {dialog && (
        <PantryItemDialog
          item={dialog.item}
          onClose={() => setDialog(null)}
          onSaved={(message) => { setDialog(null); setToast(message); }}
        />
      )}
      {suggestFor && <PantrySuggestDialog item={suggestFor} onClose={() => setSuggestFor(null)} />}
      {scanOpen && (
        <ReceiptScanDialog
          onClose={() => setScanOpen(false)}
          onManual={() => { setScanOpen(false); setDialog({ item: null }); }}
          onSaved={(result) => { setScanOpen(false); setSavedScan(result); }}
        />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
