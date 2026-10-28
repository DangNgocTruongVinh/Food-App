import { useGSAP } from "@gsap/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Apple, ArrowRight, Beef, Box, CalendarX2, ChefHat, ChevronLeft, ChevronRight,
  Clock3, CookingPot, EllipsisVertical, Grid2X2, Leaf, LayoutList, Milk,
  PackageOpen, PackagePlus, Search, SlidersHorizontal, Snowflake, Trash2, Wheat, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getApiError } from "../api/client";
import DateInput from "../components/DateInput";
import { EmptyState, LoadingState } from "../components/States";
import { toPantryFormValues } from "../features/pantry/pantry.api";
import { pantryItemPage } from "../features/pantry/pantry.logic";
import { invalidatePantryQueries, pantryMutations, pantryQueries } from "../features/pantry/pantry.queries";
import type { FoodUnit, PantryItem, StorageLocation } from "../types";
import { formatDisplayDate } from "../utils/date";

type PantryStatus = "all" | "good" | "expiring" | "expired";
type PantryView = "list" | "grid";

gsap.registerPlugin(ScrollTrigger);

const PAGE_SIZE = 8;
const initialForm = {
  name: "", category: "Rau củ", quantity: 1, unit: "ITEM" as FoodUnit,
  storageLocation: "REFRIGERATOR" as StorageLocation, expiryDate: "", minimumStock: 0, note: "",
};
const unitLabel: Record<FoodUnit, string> = { G: "g", KG: "kg", ML: "ml", L: "lít", ITEM: "cái", PACKAGE: "gói" };
const storageLabel: Record<StorageLocation, string> = {
  REFRIGERATOR: "Ngăn mát", FREEZER: "Ngăn đông", DRY_STORAGE: "Nơi khô ráo",
};

function getDaysLeft(item: PantryItem) {
  return item.expiryDate ? differenceInCalendarDays(new Date(item.expiryDate), new Date()) : null;
}

function getStatus(item: PantryItem): Exclude<PantryStatus, "all"> {
  const days = getDaysLeft(item);
  if (days !== null && days < 0) return "expired";
  if (days !== null && days <= 3) return "expiring";
  return "good";
}

function CategoryIcon({ category }: { category: string }) {
  const value = category.toLowerCase();
  if (value.includes("rau")) return <Leaf />;
  if (value.includes("thịt") || value.includes("cá")) return <Beef />;
  if (value.includes("trái")) return <Apple />;
  if (value.includes("sữa") || value.includes("trứng")) return <Milk />;
  if (value.includes("ngũ") || value.includes("khô")) return <Wheat />;
  if (value.includes("gia vị")) return <CookingPot />;
  return <Box />;
}

function expiryCopy(item: PantryItem) {
  const days = getDaysLeft(item);
  if (days === null) return { date: "Không thời hạn", relative: "—" };
  const date = formatDisplayDate(item.expiryDate!);
  if (days < 0) return { date, relative: `Quá ${Math.abs(days)} ngày` };
  if (days === 0) return { date, relative: "Hôm nay" };
  return { date, relative: `${days} ngày` };
}

export default function PantryPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PantryStatus>("all");
  const [category, setCategory] = useState("all");
  const [storage, setStorage] = useState<StorageLocation | "all">("all");
  const [sortBy, setSortBy] = useState("expiry");
  const [view, setView] = useState<PantryView>("list");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [form, setForm] = useState(initialForm);
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

  const counts = useMemo(() => ({
    total: data.length,
    good: data.filter((item) => getStatus(item) === "good").length,
    expiring: data.filter((item) => getStatus(item) === "expiring").length,
    expired: data.filter((item) => getStatus(item) === "expired").length,
    cold: data.filter((item) => item.storageLocation !== "DRY_STORAGE").length,
  }), [data]);

  const categories = useMemo(() => {
    const result = new Map<string, number>();
    data.forEach((item) => result.set(item.category, (result.get(item.category) ?? 0) + 1));
    return Array.from(result.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data
      .filter((item) => !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
      .filter((item) => status === "all" || getStatus(item) === status)
      .filter((item) => category === "all" || item.category === category)
      .filter((item) => storage === "all" || item.storageLocation === storage)
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name, "vi");
        if (sortBy === "quantity") return b.quantity - a.quantity;
        const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [category, data, search, sortBy, status, storage]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const addItem = useMutation({
    ...pantryMutations.create(form),
    onSuccess: () => {
      invalidatePantryQueries(queryClient);
      setForm(initialForm);
      setEditingItem(null);
      setShowForm(false);
    },
    onError: (err) => setFormError(getApiError(err)),
  });

  const updateItem = useMutation({
    ...pantryMutations.update(),
    onSuccess: () => {
      invalidatePantryQueries(queryClient);
      setForm(initialForm);
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
    const targetPage = pantryItemPage(filtered, itemId, PAGE_SIZE);
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
  const openAddForm = () => { setEditingItem(null); setForm(initialForm); setFormError(""); setExpiryDateInvalid(false); setShowForm(true); };
  const openEditForm = (item: PantryItem) => { setEditingItem(item); setForm(toPantryFormValues(item)); setFormError(""); setExpiryDateInvalid(false); setShowForm(true); };
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
  const expiringItems = data.filter((item) => getStatus(item) === "expiring").slice(0, 2);
  const expiredItems = data.filter((item) => getStatus(item) === "expired").slice(0, 2);
  const tipItems = data.slice(0, 3);
  const estimatedSavings = (counts.good + counts.expiring) * 12000;
  const isSaving = addItem.isPending || updateItem.isPending;

  if (isLoading) return <LoadingState />;

  return <div className="page pantry-page pantry-page-v2 max-w-full" ref={pageRef}>
    <header className="pantry-page-header pantry-v2-header">
      <div className="pantry-title"><div><h1 className="max-w-5xl">Kho thực phẩm</h1><p>Quản lý thông minh, dùng đúng lúc và giảm lãng phí.</p></div></div>
      <label className="pantry-global-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm thực phẩm..." /><kbd>⌘K</kbd></label>
      <button className="button pantry-add-button" onClick={openAddForm}><PackagePlus /> Thêm thực phẩm</button>
    </header>

    {deleteError && <div className="form-error" role="alert">{deleteError}</div>}
    {focusMissing && <div className="form-notice pantry-focus-missing" role="status"><span>Thực phẩm này không còn trong kho.</span><button type="button" onClick={() => setFocusMissing(false)} aria-label="Đóng thông báo"><X /></button></div>}

    <section className="pantry-v2-summary" aria-label="Tổng quan kho thực phẩm">
      <div className="pantry-v2-hero-media"><img src="/assets/pantry-hero.png" alt="Tủ lạnh được sắp xếp gọn gàng với thực phẩm tươi" /></div>
      <div className="pantry-hero-stats">
        <article className="pantry-v2-metric"><span className="pantry-stat-icon total"><PackageOpen /></span><div><strong>{counts.total}</strong><b>Tổng thực phẩm</b><small>Trong kho</small></div></article>
        <article className="pantry-v2-metric"><span className="pantry-stat-icon soon"><Clock3 /></span><div><strong>{counts.expiring}</strong><b>Sắp hết hạn</b><small>Trong 3 ngày</small></div></article>
        <article className="pantry-v2-metric"><span className="pantry-stat-icon expired"><CalendarX2 /></span><div><strong>{counts.expired}</strong><b>Đã hết hạn</b><small>Cần xử lý</small></div></article>
        <article className="pantry-v2-metric"><span className="pantry-stat-icon cold"><Snowflake /></span><div><strong>{counts.cold}</strong><b>Bảo quản lạnh</b><small>Ngăn mát và đông</small></div></article>
      </div>
    </section>

    <section className="pantry-v2-alert-band" aria-label="Thực phẩm cần chú ý">
      <article className="pantry-v2-alert-pane expiring">
        <div><h2>Cần dùng sớm <span>{counts.expiring}</span></h2>{expiringItems.length ? <ul>{expiringItems.map((item) => <li key={item.id}><CategoryIcon category={item.category} /><b>{item.name}</b><small>{expiryCopy(item).relative}</small></li>)}</ul> : <p>Không có thực phẩm nào cần dùng trong ba ngày tới.</p>}</div>
        <button onClick={() => setStatus("expiring")}>Xem tất cả <ArrowRight /></button>
      </article>
      <article className="pantry-v2-alert-pane expired">
        <div><h2>Đã hết hạn <span>{counts.expired}</span></h2>{expiredItems.length ? <ul>{expiredItems.map((item) => <li key={item.id}><CategoryIcon category={item.category} /><b>{item.name}</b><small>{expiryCopy(item).relative}</small></li>)}</ul> : <p>Kho của bạn hiện không có thực phẩm hết hạn.</p>}</div>
        <button onClick={() => setStatus("expired")}>Xem chi tiết <ArrowRight /></button>
      </article>
    </section>

    <div className="pantry-layout pantry-v2-layout">
      <main className="pantry-inventory-panel pantry-v2-inventory">
        <header className="pantry-inventory-toolbar">
          <div className="pantry-tabs pantry-v2-category-tabs" role="tablist" aria-label="Lọc theo danh mục"><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Tất cả <b>{counts.total}</b></button>{categories.map(([name, count]) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name} <b>{count}</b></button>)}</div>
          <div className="pantry-v2-toolbar-actions">
            <details className="pantry-v2-filter-menu"><summary><SlidersHorizontal /> Bộ lọc</summary><div className="pantry-filters"><label>Tình trạng<select value={status} onChange={(event) => setStatus(event.target.value as PantryStatus)}><option value="all">Tất cả</option><option value="good">Còn tốt</option><option value="expiring">Sắp hết hạn</option><option value="expired">Đã hết hạn</option></select></label><label>Nơi bảo quản<select value={storage} onChange={(event) => setStorage(event.target.value as StorageLocation | "all")}><option value="all">Tất cả</option><option value="REFRIGERATOR">Ngăn mát</option><option value="FREEZER">Ngăn đông</option><option value="DRY_STORAGE">Nơi khô ráo</option></select></label><label>Sắp xếp<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="expiry">Hạn sử dụng gần nhất</option><option value="name">Tên A–Z</option><option value="quantity">Số lượng nhiều nhất</option></select></label></div></details>
            <div className="pantry-view-toggle" aria-label="Kiểu hiển thị"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="Dạng danh sách"><LayoutList /></button><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Dạng lưới"><Grid2X2 /></button></div>
          </div>
        </header>

        {visibleItems.length ? view === "list" ? <div className="pantry-table-wrap">
          <div className="pantry-table pantry-table-head"><span>Thực phẩm</span><span>Danh mục</span><span>Số lượng</span><span>Hạn sử dụng</span><span>Nơi bảo quản</span><span>Tình trạng</span><span /></div>
          {visibleItems.map((item) => {
            const itemStatus = getStatus(item); const expiry = expiryCopy(item);
            return <article id={`pantry-item-${item.id}`} className={`pantry-table pantry-table-row${focusedItemId === item.id ? " notification-target" : ""}`} key={item.id}>
              <div className="pantry-food-name"><span aria-hidden="true"><CategoryIcon category={item.category} /></span><strong>{item.name}</strong></div><span data-label="Danh mục">{item.category}</span><strong data-label="Số lượng">{item.quantity} {unitLabel[item.unit]}</strong><div className={`pantry-expiry ${itemStatus}`} data-label="Hạn sử dụng"><span>{expiry.date}</span><small>{expiry.relative}</small></div><span data-label="Nơi bảo quản">{storageLabel[item.storageLocation]}</span><span data-label="Tình trạng" className={`pantry-status ${itemStatus}`}>{itemStatus === "good" ? "Còn tốt" : itemStatus === "expiring" ? "Sắp hết hạn" : "Đã hết hạn"}</span><div className="pantry-row-actions"><button onClick={() => openEditForm(item)} aria-label={`Sửa ${item.name}`} title="Sửa thực phẩm"><EllipsisVertical /></button><button className="danger" disabled={removeItem.isPending} onClick={() => confirmRemove(item)} aria-label={`Xóa ${item.name}`} title="Xóa thực phẩm"><Trash2 /></button></div>
            </article>;
          })}
        </div> : <div className="pantry-card-grid">{visibleItems.map((item) => { const itemStatus = getStatus(item); const expiry = expiryCopy(item); return <article id={`pantry-item-${item.id}`} className={`pantry-item-card${focusedItemId === item.id ? " notification-target" : ""}`} key={item.id}><header><span aria-hidden="true"><CategoryIcon category={item.category} /></span><div className="pantry-row-actions"><button onClick={() => openEditForm(item)} aria-label={`Sửa ${item.name}`} title="Sửa thực phẩm"><EllipsisVertical /></button><button className="danger" onClick={() => confirmRemove(item)} aria-label={`Xóa ${item.name}`}><Trash2 /></button></div></header><small>{item.category}</small><h3>{item.name}</h3><b>{item.quantity} {unitLabel[item.unit]}</b><footer><span className={`pantry-status ${itemStatus}`}>{itemStatus === "good" ? "Còn tốt" : itemStatus === "expiring" ? "Sắp hết hạn" : "Đã hết hạn"}</span><em>{expiry.relative}</em></footer></article>; })}</div> : <EmptyState title="Không tìm thấy thực phẩm">Thử thay đổi từ khóa hoặc bộ lọc để xem thêm thực phẩm.</EmptyState>}

        {filtered.length > 0 && <footer className="pantry-pagination"><span>Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} trong {filtered.length} thực phẩm</span><nav aria-label="Phân trang"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={page === number ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}<button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight /></button></nav></footer>}
      </main>

      <aside className="pantry-insights pantry-v2-insights">
        <section className="pantry-v2-recipe-card pantry-v2-stack-card"><div><h2>Nấu gì từ kho? <span className="pantry-v2-inline-food"><img src="/assets/recipe-vegan-bowl.jpg" alt="" /></span></h2><p>Nouri gợi ý món ăn dựa trên nguyên liệu bạn đang có, ưu tiên thực phẩm sắp hết hạn.</p><Link to="/assistant"><ChefHat /> Xem gợi ý món ăn</Link></div><img src="/assets/recipe-vegan-bowl.jpg" alt="Bowl rau củ Nouri gợi ý" /></section>
        <section className="pantry-v2-tips pantry-v2-stack-card"><header><h2>Mẹo bảo quản cho bạn</h2><Link to="/assistant">Xem tất cả</Link></header><div className="pantry-v2-tip-list">{tipItems.length ? tipItems.map((item) => <article key={item.id}><span><CategoryIcon category={item.category} /></span><div><b>{item.name} của bạn</b><small>{item.storageLocation === "DRY_STORAGE" ? "Đặt nơi khô ráo, kín và tránh ánh nắng trực tiếp." : `Đang để ở ${storageLabel[item.storageLocation].toLowerCase()}. Nên dùng đúng hạn để giữ độ tươi ngon.`}</small></div></article>) : <p>Thêm thực phẩm để nhận mẹo bảo quản phù hợp.</p>}</div></section>
        <section className="pantry-v2-savings pantry-v2-stack-card"><h2>Nouri giúp bạn tiết kiệm hơn mỗi ngày</h2><div><article><strong>{new Intl.NumberFormat("vi-VN").format(estimatedSavings)}đ</strong><small>Tiết kiệm ước tính</small></article><article><strong>{counts.good + counts.expiring}</strong><small>Thực phẩm dùng đúng hạn</small></article><article><strong>{counts.total}</strong><small>Nguyên liệu được theo dõi</small></article></div></section>
      </aside>
    </div>

    {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={closeForm}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="pantry-modal-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">{editingItem ? "Chỉnh sửa nguyên liệu" : "Nguyên liệu mới"}</span><h2 id="pantry-modal-title">{editingItem ? "Sửa thực phẩm" : "Thêm vào kho"}</h2></div>
          <button type="button" className="icon-button" onClick={closeForm} aria-label="Đóng"><X /></button>
        </div>
        <div className="form-grid">
          <label className="span-2">Tên thực phẩm<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Ức gà" /></label>
          <label>Nhóm<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Rau củ</option><option>Thịt & cá</option><option>Trứng & sữa</option><option>Ngũ cốc</option><option>Trái cây</option><option>Gia vị</option><option>Khác</option></select></label>
          <label>Hạn sử dụng<DateInput value={form.expiryDate} onChange={(expiryDate, status) => { setForm({ ...form, expiryDate }); setExpiryDateInvalid(status === "invalid"); }} /></label>
          <label>Số lượng<input required type="number" min="0.1" step="0.1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /></label>
          <label>Đơn vị<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as FoodUnit })}><option value="G">gram</option><option value="KG">kg</option><option value="ML">ml</option><option value="L">lít</option><option value="ITEM">cái</option><option value="PACKAGE">gói</option></select></label>
          <label>Tồn kho tối thiểu<input required type="number" min="0" step="0.1" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: Number(event.target.value) })} /></label>
          <label>Nơi bảo quản<select value={form.storageLocation} onChange={(event) => setForm({ ...form, storageLocation: event.target.value as StorageLocation })}><option value="REFRIGERATOR">Ngăn mát</option><option value="FREEZER">Ngăn đông</option><option value="DRY_STORAGE">Nơi khô ráo</option></select></label>
          <label className="span-2">Ghi chú<textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Thông tin bổ sung..." /></label>
        </div>
        {formError && <div className="form-error" role="alert">{formError}</div>}
        <div className="modal-actions"><button type="button" className="button ghost" onClick={closeForm}>Hủy</button><button className="button primary" disabled={isSaving}>{isSaving ? "Đang lưu..." : editingItem ? "Lưu thay đổi" : "Thêm thực phẩm"}</button></div>
      </form>
    </div>}
  </div>;
}
