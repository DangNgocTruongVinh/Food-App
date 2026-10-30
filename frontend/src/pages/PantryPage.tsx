import { useGSAP } from "@gsap/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../api/client";
import PantryAlerts from "../components/pantry/PantryAlerts";
import PantryCardGrid from "../components/pantry/PantryCardGrid";
import PantryHeader from "../components/pantry/PantryHeader";
import PantryInsights from "../components/pantry/PantryInsights";
import PantryItemForm from "../components/pantry/PantryItemForm";
import PantryPagination from "../components/pantry/PantryPagination";
import PantrySummary from "../components/pantry/PantrySummary";
import PantryTable from "../components/pantry/PantryTable";
import PantryToolbar from "../components/pantry/PantryToolbar";
import { EmptyState, LoadingState } from "../components/States";
import { toPantryFormValues } from "../features/pantry/pantry.api";
import {
  estimatedSavings, filterAndSortPantry, getPantryStatus, initialPantryForm, PANTRY_PAGE_SIZE, pantryCategories, pantryCounts,
  pantryItemPage, type PantryStatusFilter, type PantryView,
} from "../features/pantry/pantry.logic";
import { invalidatePantryQueries, pantryMutations, pantryQueries } from "../features/pantry/pantry.queries";
import type { PantryItem, StorageLocation } from "../types";

gsap.registerPlugin(ScrollTrigger);

export default function PantryPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PantryStatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [storage, setStorage] = useState<StorageLocation | "all">("all");
  const [sortBy, setSortBy] = useState("expiry");
  const [view, setView] = useState<PantryView>("list");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [form, setForm] = useState(initialPantryForm);
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [expiryDateInvalid, setExpiryDateInvalid] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusParam = searchParams.get("item");
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [focusMissing, setFocusMissing] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const pendingPageFocus = useRef<string | null>(null);
  const pendingScroll = useRef<string | null>(null);

  const { data = [], isLoading } = useQuery(pantryQueries.list());

  const counts = useMemo(() => pantryCounts(data), [data]);
  const categories = useMemo(() => pantryCategories(data), [data]);
  const filtered = useMemo(
    () => filterAndSortPantry(data, { search, status, category, storage, sortBy }),
    [category, data, search, sortBy, status, storage],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PANTRY_PAGE_SIZE));
  const visibleItems = useMemo(() => filtered.slice((page - 1) * PANTRY_PAGE_SIZE, page * PANTRY_PAGE_SIZE), [filtered, page]);

  const addItem = useMutation({
    ...pantryMutations.create(form),
    onSuccess: () => {
      invalidatePantryQueries(queryClient);
      setForm(initialPantryForm);
      setEditingItem(null);
      setShowForm(false);
    },
    onError: (err) => setFormError(getApiError(err)),
  });

  const updateItem = useMutation({
    ...pantryMutations.update(),
    onSuccess: () => {
      invalidatePantryQueries(queryClient);
      setForm(initialPantryForm);
      setEditingItem(null);
      setShowForm(false);
    },
    onError: (err) => setFormError(getApiError(err)),
  });

  const removeItem = useMutation({
    ...pantryMutations.remove(),
    onSuccess: () => {
      invalidatePantryQueries(queryClient);
      setDeleteError("");
    },
    onError: (err) => setDeleteError(getApiError(err)),
  });

  // Liên kết từ thông báo (/pantry?item=...): bỏ bộ lọc để item chắc chắn hiện ra, rồi xóa tham số khỏi URL.
  useEffect(() => {
    if (!focusParam || isLoading) return;
    if (data.some((item) => item.id === focusParam)) {
      setSearch(""); setStatus("all"); setCategory("all"); setStorage("all");
      setFocusedItemId(focusParam);
      setFocusMissing(false);
      pendingPageFocus.current = focusParam;
      setFocusRequest((value) => value + 1);
    } else {
      setFocusedItemId(null);
      setFocusMissing(true);
    }
    setSearchParams((params) => { params.delete("item"); return params; }, { replace: true });
  }, [data, focusParam, isLoading, setSearchParams]);

  useEffect(() => setPage(1), [category, search, sortBy, status, storage]);
  // Đặt sau effect về trang 1 để trang của item được focus là giá trị cuối cùng trong cùng lần commit.
  useEffect(() => {
    const itemId = pendingPageFocus.current;
    if (!itemId) return;
    const targetPage = pantryItemPage(filtered, itemId, PANTRY_PAGE_SIZE);
    if (targetPage === null) return;
    pendingPageFocus.current = null;
    pendingScroll.current = itemId;
    setPage(targetPage);
  }, [filtered, focusRequest]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => {
    const itemId = pendingScroll.current;
    if (!itemId || !visibleItems.some((item) => item.id === itemId)) return;
    pendingScroll.current = null;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`pantry-item-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleItems]);
  useEffect(() => {
    if (!showForm) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setShowForm(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showForm]);

  useGSAP(() => {
    if (isLoading) return;
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .from(".pantry-v2-header > *", { y: 16, autoAlpha: 0, duration: .55, stagger: .07 })
        .from(".pantry-v2-metric", { y: 20, autoAlpha: 0, duration: .5, stagger: .06 }, "-=.28")
        .from(".pantry-v2-alert-pane", { y: 14, autoAlpha: 0, duration: .45, stagger: .08 }, "-=.22");

      gsap.fromTo(".pantry-v2-hero-media", { scale: .88, autoAlpha: .68 }, {
        scale: 1,
        autoAlpha: 1,
        ease: "none",
        scrollTrigger: { trigger: ".pantry-v2-summary", start: "top 88%", end: "bottom 42%", scrub: .65 },
      });

      gsap.utils.toArray<HTMLElement>(".pantry-v2-stack-card").forEach((card, index) => {
        gsap.from(card, {
          y: -Math.min(34, index * 18),
          scale: 1 - index * .018,
          autoAlpha: .3,
          ease: "power2.out",
          scrollTrigger: { trigger: card, start: "top 92%", end: "top 66%", scrub: .5 },
        });
      });
    });
    return () => motion.revert();
  }, { scope: pageRef, dependencies: [isLoading], revertOnUpdate: true });

  const closeForm = () => { setShowForm(false); setEditingItem(null); setFormError(""); };
  const openAddForm = () => {
    setEditingItem(null); setForm(initialPantryForm); setFormError(""); setExpiryDateInvalid(false); setShowForm(true);
  };
  const openEditForm = (item: PantryItem) => {
    setEditingItem(item); setForm(toPantryFormValues(item)); setFormError(""); setExpiryDateInvalid(false); setShowForm(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError("");
    // Ô trống = không có hạn dùng (gửi null, kể cả khi sửa để xóa hạn cũ); nhập sai thì không được lưu.
    if (expiryDateInvalid) { setFormError("Hạn sử dụng chưa hợp lệ. Nhập theo dạng dd/mm/yyyy hoặc để trống."); return; }
    if (editingItem) updateItem.mutate({ id: editingItem.id, form });
    else addItem.mutate();
  };
  const confirmRemove = (item: PantryItem) => {
    if (window.confirm(`Xóa “${item.name}” khỏi kho thực phẩm?`)) {
      setDeleteError("");
      removeItem.mutate(item.id);
    }
  };
  const expiringItems = data.filter((item) => getPantryStatus(item) === "expiring").slice(0, 2);
  const expiredItems = data.filter((item) => getPantryStatus(item) === "expired").slice(0, 2);

  if (isLoading) return <LoadingState />;

  return <div className="page pantry-page pantry-page-v2 max-w-full" ref={pageRef}>
    <PantryHeader search={search} onSearchChange={setSearch} onAdd={openAddForm} />

    {deleteError && <div className="form-error" role="alert">{deleteError}</div>}
    {focusMissing && <div className="form-notice pantry-focus-missing" role="status">
      <span>Thực phẩm này không còn trong kho.</span>
      <button type="button" onClick={() => setFocusMissing(false)} aria-label="Đóng thông báo"><X /></button>
    </div>}

    <PantrySummary counts={counts} />
    <PantryAlerts counts={counts} expiringItems={expiringItems} expiredItems={expiredItems} onShowStatus={setStatus} />

    <div className="pantry-layout pantry-v2-layout">
      <main className="pantry-inventory-panel pantry-v2-inventory">
        <PantryToolbar
          total={counts.total} categories={categories} category={category} status={status} storage={storage} sortBy={sortBy} view={view}
          onCategoryChange={setCategory} onStatusChange={setStatus} onStorageChange={setStorage} onSortChange={setSortBy} onViewChange={setView}
        />

        {visibleItems.length ? view === "list"
          ? <PantryTable items={visibleItems} focusedItemId={focusedItemId} deleting={removeItem.isPending} onEdit={openEditForm} onDelete={confirmRemove} />
          : <PantryCardGrid items={visibleItems} focusedItemId={focusedItemId} onEdit={openEditForm} onDelete={confirmRemove} />
          : <EmptyState title="Không tìm thấy thực phẩm">Thử thay đổi từ khóa hoặc bộ lọc để xem thêm thực phẩm.</EmptyState>}

        {filtered.length > 0 && <PantryPagination
          page={page} pageCount={pageCount} pageSize={PANTRY_PAGE_SIZE} total={filtered.length} onPageChange={setPage}
        />}
      </main>

      <PantryInsights counts={counts} tipItems={data.slice(0, 3)} savings={estimatedSavings(counts)} />
    </div>

    {showForm && <PantryItemForm
      form={form} editing={Boolean(editingItem)} error={formError} saving={addItem.isPending || updateItem.isPending}
      onChange={setForm} onExpiryStatusChange={(expiryStatus) => setExpiryDateInvalid(expiryStatus === "invalid")}
      onSubmit={submit} onClose={closeForm}
    />}
  </div>;
}
