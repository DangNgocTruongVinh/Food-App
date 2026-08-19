import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import {
  Apple, Beef, Box, CalendarX2, ChevronLeft, ChevronRight, CircleGauge, Clock3,
  CookingPot, EllipsisVertical, Grid2X2, Leaf, LayoutList, Milk, PackageOpen,
  PackagePlus, ScanLine, Search, Snowflake, Trash2, Wheat, X,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { api, getApiError } from "../api/client";
import { EmptyState, LoadingState } from "../components/States";
import type { FoodUnit, PantryItem } from "../types";

type PantryStatus = "all" | "good" | "expiring" | "expired";
type PantryView = "list" | "grid";

const PAGE_SIZE = 8;
const initialForm = { name: "", category: "Rau củ", quantity: 1, unit: "ITEM" as FoodUnit, expiryDate: "", note: "" };
const unitLabel: Record<FoodUnit, string> = { G: "g", KG: "kg", ML: "ml", L: "lít", ITEM: "cái", PACKAGE: "gói" };

function getDaysLeft(item: PantryItem) {
  return item.expiryDate ? differenceInCalendarDays(new Date(item.expiryDate), new Date()) : null;
}

function getStatus(item: PantryItem): Exclude<PantryStatus, "all"> {
  const days = getDaysLeft(item);
  if (days !== null && days < 0) return "expired";
  if (days !== null && days <= 3) return "expiring";
  return "good";
}

function getStorage(item: PantryItem) {
  const note = item.note?.toLowerCase() ?? "";
  const name = item.name.toLowerCase();
  const category = item.category.toLowerCase();
  if (note.includes("đông") || name.includes("cá") || name.includes("tôm")) return "Ngăn đông";
  if (note.includes("khô") || category.includes("ngũ cốc") || category.includes("gia vị")) return "Nơi khô ráo";
  return "Ngăn mát";
}

function getFoodEmoji(item: PantryItem) {
  const value = `${item.name} ${item.category}`.toLowerCase();
  if (value.includes("trứng")) return "🥚";
  if (value.includes("gạo") || value.includes("yến mạch")) return "🌾";
  if (value.includes("gà")) return "🍗";
  if (value.includes("bò") || value.includes("thịt")) return "🥩";
  if (value.includes("cá") || value.includes("tôm")) return "🐟";
  if (value.includes("sữa")) return "🥛";
  if (value.includes("cà chua")) return "🍅";
  if (value.includes("cà rốt")) return "🥕";
  if (value.includes("trái") || value.includes("quả")) return "🍊";
  if (value.includes("rau") || value.includes("củ")) return "🥬";
  return "🥫";
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
  const date = format(new Date(item.expiryDate!), "dd/MM/yyyy");
  if (days < 0) return { date, relative: `Quá ${Math.abs(days)} ngày` };
  if (days === 0) return { date, relative: "Hôm nay" };
  return { date, relative: `${days} ngày` };
}

export default function PantryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PantryStatus>("all");
  const [category, setCategory] = useState("all");
  const [storage, setStorage] = useState("all");
  const [sortBy, setSortBy] = useState("expiry");
  const [view, setView] = useState<PantryView>("list");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const { data = [], isLoading } = useQuery({ queryKey: ["pantry"], queryFn: async () => (await api.get<PantryItem[]>("/pantry")).data });

  const counts = useMemo(() => ({
    total: data.length,
    good: data.filter((item) => getStatus(item) === "good").length,
    expiring: data.filter((item) => getStatus(item) === "expiring").length,
    expired: data.filter((item) => getStatus(item) === "expired").length,
    cold: data.filter((item) => getStorage(item) !== "Nơi khô ráo").length,
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
      .filter((item) => storage === "all" || getStorage(item) === storage)
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name, "vi");
        if (sortBy === "quantity") return b.quantity - a.quantity;
        const aTime = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
  }, [category, data, search, sortBy, status, storage]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const addItem = useMutation({
    mutationFn: () => api.post("/pantry", { ...form, quantity: Number(form.quantity), expiryDate: form.expiryDate || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setForm(initialForm);
      setShowForm(false);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const removeItem = useMutation({
    mutationFn: (id: string) => api.delete(`/pantry/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  useEffect(() => setPage(1), [category, search, sortBy, status, storage]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  useEffect(() => {
    if (!showForm) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setShowForm(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showForm]);

  const submit = (event: FormEvent) => { event.preventDefault(); setError(""); addItem.mutate(); };
  const confirmRemove = (item: PantryItem) => { if (window.confirm(`Xóa “${item.name}” khỏi kho thực phẩm?`)) removeItem.mutate(item.id); };

  if (isLoading) return <LoadingState />;

  return <div className="page pantry-page">
    <header className="pantry-page-header">
      <div className="pantry-title"><PackageOpen /><h1>Kho thực phẩm</h1></div>
      <label className="pantry-global-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm thực phẩm..." /><kbd>⌘K</kbd></label>
      <button className="button pantry-add-button" onClick={() => setShowForm(true)}><PackagePlus /> Thêm thực phẩm</button>
    </header>

    <section className="pantry-hero" aria-label="Tổng quan kho thực phẩm">
      <div className="pantry-hero-copy"><span className="eyebrow">Kho thực phẩm thông minh</span><h2>Quản lý thực phẩm trong kho</h2><p>Theo dõi hạn sử dụng, số lượng và tình trạng thực phẩm.</p></div>
      <div className="pantry-hero-stats">
        <article><span className="pantry-stat-icon total"><PackageOpen /></span><div><strong>{counts.total}</strong><b>Tổng thực phẩm</b><small>Trong kho</small></div></article>
        <article><span className="pantry-stat-icon soon"><Clock3 /></span><div><strong>{counts.expiring}</strong><b>Sắp hết hạn</b><small>Trong 3 ngày</small></div></article>
        <article><span className="pantry-stat-icon expired"><CalendarX2 /></span><div><strong>{counts.expired}</strong><b>Đã hết hạn</b><small>Cần xử lý</small></div></article>
        <article><span className="pantry-stat-icon cold"><Snowflake /></span><div><strong>{counts.cold}</strong><b>Bảo quản lạnh</b><small>Ngăn mát/đông</small></div></article>
      </div>
    </section>

    <div className="pantry-layout">
      <aside className="pantry-filter-panel">
        <section><h2>Danh mục</h2><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><span><PackageOpen />Tất cả</span><b>{counts.total}</b></button>{categories.map(([name, count]) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)}><span><CategoryIcon category={name} />{name}</span><b>{count}</b></button>)}</section>
        <section className="pantry-filters"><h2>Bộ lọc</h2><label>Tình trạng<select value={status} onChange={(event) => setStatus(event.target.value as PantryStatus)}><option value="all">Tất cả</option><option value="good">Còn tốt</option><option value="expiring">Sắp hết hạn</option><option value="expired">Đã hết hạn</option></select></label><label>Nơi bảo quản<select value={storage} onChange={(event) => setStorage(event.target.value)}><option value="all">Tất cả</option><option>Ngăn mát</option><option>Ngăn đông</option><option>Nơi khô ráo</option></select></label><label>Sắp xếp<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="expiry">Hạn sử dụng: gần nhất</option><option value="name">Tên: A–Z</option><option value="quantity">Số lượng: nhiều nhất</option></select></label></section>
      </aside>

      <main className="pantry-inventory-panel">
        <header className="pantry-inventory-toolbar">
          <div className="pantry-tabs" role="tablist" aria-label="Lọc theo hạn sử dụng"><button className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>Tất cả <b>{counts.total}</b></button><button className={status === "expiring" ? "active" : ""} onClick={() => setStatus("expiring")}>Sắp hết hạn <b>{counts.expiring}</b></button><button className={status === "expired" ? "active" : ""} onClick={() => setStatus("expired")}>Đã hết hạn <b>{counts.expired}</b></button></div>
          <div className="pantry-view-toggle" aria-label="Kiểu hiển thị"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="Dạng danh sách"><LayoutList /></button><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Dạng lưới"><Grid2X2 /></button></div>
        </header>

        {visibleItems.length ? view === "list" ? <div className="pantry-table-wrap">
          <div className="pantry-table pantry-table-head"><span>Thực phẩm</span><span>Danh mục</span><span>Số lượng</span><span>Hạn sử dụng</span><span>Nơi bảo quản</span><span>Tình trạng</span><span /></div>
          {visibleItems.map((item) => {
            const itemStatus = getStatus(item); const expiry = expiryCopy(item);
            return <article className="pantry-table pantry-table-row" key={item.id}>
              <div className="pantry-food-name"><span aria-hidden="true">{getFoodEmoji(item)}</span><strong>{item.name}</strong></div><span data-label="Danh mục">{item.category}</span><strong data-label="Số lượng">{item.quantity} {unitLabel[item.unit]}</strong><div className={`pantry-expiry ${itemStatus}`} data-label="Hạn sử dụng"><span>{expiry.date}</span><small>{expiry.relative}</small></div><span data-label="Nơi bảo quản">{getStorage(item)}</span><span data-label="Tình trạng" className={`pantry-status ${itemStatus}`}>{itemStatus === "good" ? "Còn tốt" : itemStatus === "expiring" ? "Sắp hết hạn" : "Đã hết hạn"}</span><div className="pantry-row-actions"><button aria-label={`Tùy chọn cho ${item.name}`} title="Tùy chọn"><EllipsisVertical /></button><button className="danger" disabled={removeItem.isPending} onClick={() => confirmRemove(item)} aria-label={`Xóa ${item.name}`} title="Xóa thực phẩm"><Trash2 /></button></div>
            </article>;
          })}
        </div> : <div className="pantry-card-grid">{visibleItems.map((item) => { const itemStatus = getStatus(item); const expiry = expiryCopy(item); return <article className="pantry-item-card" key={item.id}><header><span aria-hidden="true">{getFoodEmoji(item)}</span><button className="danger" onClick={() => confirmRemove(item)} aria-label={`Xóa ${item.name}`}><Trash2 /></button></header><small>{item.category}</small><h3>{item.name}</h3><b>{item.quantity} {unitLabel[item.unit]}</b><footer><span className={`pantry-status ${itemStatus}`}>{itemStatus === "good" ? "Còn tốt" : itemStatus === "expiring" ? "Sắp hết hạn" : "Đã hết hạn"}</span><em>{expiry.relative}</em></footer></article>; })}</div> : <EmptyState title="Không tìm thấy thực phẩm">Thử thay đổi từ khóa hoặc bộ lọc để xem thêm thực phẩm.</EmptyState>}

        {filtered.length > 0 && <footer className="pantry-pagination"><span>Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} trong {filtered.length} thực phẩm</span><nav aria-label="Phân trang"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button key={number} className={page === number ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}<button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight /></button></nav></footer>}
      </main>

      <aside className="pantry-insights">
        <section className="pantry-overview-card"><h2>Tổng quan kho</h2><div className="pantry-donut" style={{ "--good": `${counts.total ? counts.good / counts.total * 100 : 100}%`, "--soon": `${counts.total ? (counts.good + counts.expiring) / counts.total * 100 : 100}%` } as CSSProperties}><div><strong>{counts.total}</strong><small>Thực phẩm</small></div></div><ul><li><i className="good" /><span>Còn tốt</span><b>{counts.good} ({counts.total ? Math.round(counts.good / counts.total * 100) : 0}%)</b></li><li><i className="expiring" /><span>Sắp hết hạn</span><b>{counts.expiring} ({counts.total ? Math.round(counts.expiring / counts.total * 100) : 0}%)</b></li><li><i className="expired" /><span>Đã hết hạn</span><b>{counts.expired} ({counts.total ? Math.round(counts.expired / counts.total * 100) : 0}%)</b></li></ul></section>
        <section className="pantry-tips-card"><h2>Mẹo bảo quản</h2><div><span className="leaf"><Leaf /></span><p><b>Rau xanh</b><small>Nên bảo quản trong túi kín và để ở ngăn mát.</small></p></div><div><span className="meat"><Beef /></span><p><b>Thịt cá</b><small>Chia nhỏ và bảo quản ngăn đông nếu chưa dùng ngay.</small></p></div><div><span className="fruit"><Apple /></span><p><b>Trái cây</b><small>Táo, lê nên để riêng với chuối và quả chín nhanh.</small></p></div></section>
        <section className="pantry-scan-card"><span className="pantry-scan-icon"><CircleGauge /></span><h2>Quét nhanh</h2><p>Thêm thực phẩm nhanh chóng vào kho của bạn.</p><button onClick={() => setShowForm(true)}><ScanLine /> Quét ngay</button></section>
      </aside>
    </div>

    {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowForm(false)}><form className="modal" role="dialog" aria-modal="true" aria-labelledby="pantry-modal-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Nguyên liệu mới</span><h2 id="pantry-modal-title">Thêm vào kho</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)} aria-label="Đóng"><X /></button></div><div className="form-grid"><label className="span-2">Tên thực phẩm<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Ức gà" /></label><label>Nhóm<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Rau củ</option><option>Thịt & cá</option><option>Trứng & sữa</option><option>Ngũ cốc</option><option>Trái cây</option><option>Gia vị</option><option>Khác</option></select></label><label>Hạn sử dụng<input type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></label><label>Số lượng<input required type="number" min="0.1" step="0.1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /></label><label>Đơn vị<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as FoodUnit })}><option value="G">gram</option><option value="KG">kg</option><option value="ML">ml</option><option value="L">lít</option><option value="ITEM">cái</option><option value="PACKAGE">gói</option></select></label><label className="span-2">Ghi chú<textarea rows={2} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ví dụ: ngăn đông, nơi khô ráo..." /></label></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button ghost" onClick={() => setShowForm(false)}>Hủy</button><button className="button primary" disabled={addItem.isPending}>{addItem.isPending ? "Đang lưu..." : "Thêm thực phẩm"}</button></div></form></div>}
  </div>;
}
