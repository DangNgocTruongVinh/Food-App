import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { Filter, PackagePlus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { api, getApiError } from "../api/client";
import { EmptyState, LoadingState } from "../components/States";
import type { FoodUnit, PantryItem } from "../types";

const initialForm = { name: "", category: "Rau củ", quantity: 1, unit: "ITEM" as FoodUnit, expiryDate: "", note: "" };

export default function PantryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [form, setForm] = useState(initialForm); const [error, setError] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["pantry"], queryFn: async () => (await api.get<PantryItem[]>("/pantry")).data });
  const filtered = useMemo(() => data.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const addItem = useMutation({ mutationFn: () => api.post("/pantry", { ...form, quantity: Number(form.quantity), expiryDate: form.expiryDate || null }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pantry"] }); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); setForm(initialForm); setShowForm(false); }, onError: (err) => setError(getApiError(err)) });
  const removeItem = useMutation({ mutationFn: (id: string) => api.delete(`/pantry/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pantry"] }); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); } });
  const submit = (event: FormEvent) => { event.preventDefault(); setError(""); addItem.mutate(); };
  if (isLoading) return <LoadingState />;
  return <div className="page">
    <header className="page-header"><div><span className="eyebrow">Quản lý nguyên liệu</span><h1>Kho thực phẩm</h1><p>Theo dõi số lượng và hạn sử dụng để không bỏ phí thức ăn.</p></div><button className="button primary" onClick={() => setShowForm(true)}><PackagePlus size={18} /> Thêm thực phẩm</button></header>
    <div className="toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc nhóm..." /></label><span className="toolbar-count"><Filter size={16} /> {filtered.length} thực phẩm</span></div>
    {filtered.length ? <div className="pantry-grid">{filtered.map((item) => {
      const days = item.expiryDate ? differenceInCalendarDays(new Date(item.expiryDate), new Date()) : null;
      return <article className="food-card" key={item.id}><div className="food-card-head"><span className="category">{item.category}</span><button className="icon-button danger" onClick={() => removeItem.mutate(item.id)} aria-label={`Xóa ${item.name}`}><Trash2 size={17} /></button></div><span className="food-emoji">{item.name.charAt(0).toUpperCase()}</span><h3>{item.name}</h3><strong>{item.quantity} <small>{item.unit.toLowerCase()}</small></strong><div className={`expiry-line ${days !== null && days <= 3 ? "urgent" : ""}`}><span />{days === null ? "Không có hạn dùng" : days < 0 ? "Đã hết hạn" : `Còn ${days} ngày · ${format(new Date(item.expiryDate!), "dd/MM")}`}</div></article>;
    })}</div> : <EmptyState title="Kho thực phẩm đang trống">Thêm những nguyên liệu bạn đang có để AI ưu tiên sử dụng khi lập thực đơn.</EmptyState>}
    {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Nguyên liệu mới</span><h2>Thêm vào kho</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}><X /></button></div><div className="form-grid"><label className="span-2">Tên thực phẩm<input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Ức gà" /></label><label>Nhóm<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Rau củ</option><option>Thịt & cá</option><option>Trứng & sữa</option><option>Ngũ cốc</option><option>Trái cây</option><option>Gia vị</option><option>Khác</option></select></label><label>Hạn sử dụng<input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></label><label>Số lượng<input required type="number" min="0.1" step="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></label><label>Đơn vị<select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as FoodUnit })}><option value="G">gram</option><option value="KG">kg</option><option value="ML">ml</option><option value="L">lít</option><option value="ITEM">cái</option><option value="PACKAGE">gói</option></select></label><label className="span-2">Ghi chú<textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Vị trí bảo quản, trạng thái..." /></label></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button ghost" onClick={() => setShowForm(false)}>Hủy</button><button className="button primary" disabled={addItem.isPending}>{addItem.isPending ? "Đang lưu..." : "Thêm thực phẩm"}</button></div></form></div>}
  </div>;
}
