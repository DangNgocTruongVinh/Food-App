import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import { Apple, CalendarDays, Check, ChevronDown, ListChecks, LoaderCircle, MoonStar, ShoppingBasket, Soup, Sparkles, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";
import { api, getApiError } from "../api/client";
import { EmptyState, LoadingState } from "../components/States";
import type { MealPlan, MealType } from "../types";

const mealLabels: Record<MealType, string> = { BREAKFAST: "Bữa sáng", LUNCH: "Bữa trưa", DINNER: "Bữa tối", SNACK: "Bữa phụ" };
const mealIcons = { BREAKFAST: SunMedium, LUNCH: Soup, DINNER: MoonStar, SNACK: Apple };

export default function MealPlansPage() {
  const queryClient = useQueryClient(); const [selectedId, setSelectedId] = useState(""); const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd")); const [error, setError] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["meal-plans"], queryFn: async () => (await api.get<MealPlan[]>("/meal-plans")).data });
  useEffect(() => { if (!selectedId && data.length) setSelectedId(data[0].id); }, [data, selectedId]);
  const selected = data.find((plan) => plan.id === selectedId) ?? data[0];
  const planMeals = selected?.days.flatMap((day) => day.items) ?? [];
  const completedMeals = planMeals.filter((item) => item.completed).length;
  const purchasedItems = selected?.shoppingItems.filter((item) => item.purchased).length ?? 0;
  const generate = useMutation({ mutationFn: async () => (await api.post<MealPlan>("/meal-plans/generate", { startDate })).data, onSuccess: (plan) => { queryClient.invalidateQueries({ queryKey: ["meal-plans"] }); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); setSelectedId(plan.id); setError(""); }, onError: (err) => setError(getApiError(err)) });
  const toggleMeal = useMutation({ mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api.patch(`/meal-plans/items/${id}`, { completed }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["meal-plans"] }); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); } });
  const toggleShop = useMutation({ mutationFn: ({ id, purchased }: { id: string; purchased: boolean }) => api.patch(`/meal-plans/shopping/${id}`, { purchased }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plans"] }) });
  const activate = useMutation({ mutationFn: () => {
    if (!selected) throw new Error("Chưa chọn thực đơn");
    return api.patch(`/meal-plans/${selected.id}/status`, { status: "ACTIVE" });
  }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["meal-plans"] }); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); } });
  if (isLoading) return <LoadingState />;
  return <div className="page"><header className="page-header"><div><span className="eyebrow">Lập kế hoạch thông minh</span><h1>Thực đơn của bạn</h1><p>AI cân bằng dinh dưỡng và ưu tiên thực phẩm đang có trong kho.</p></div><div className="generate-controls"><input aria-label="Ngày bắt đầu" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /><button className="button primary" onClick={() => generate.mutate()} disabled={generate.isPending}>{generate.isPending ? <LoaderCircle className="spin" /> : <Sparkles size={17} />}{generate.isPending ? "AI đang lập..." : "Tạo thực đơn AI"}</button></div></header>{error && <div className="form-error page-error">{error}</div>}
    {!selected ? <EmptyState title="Chưa có thực đơn nào">Chọn ngày bắt đầu và để AI xây kế hoạch ăn uống 7 ngày đầu tiên.</EmptyState> : <>
      <div className="plan-toolbar"><label><CalendarDays size={18} /><select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>{data.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><ChevronDown size={16} /></label><div><span className={`status ${selected.status.toLowerCase()}`}>{selected.status === "ACTIVE" ? "Đang áp dụng" : selected.status === "COMPLETED" ? "Đã hoàn thành" : "Bản nháp"}</span>{selected.status === "DRAFT" && <button className="button secondary small" onClick={() => activate.mutate()}>Áp dụng kế hoạch</button>}</div></div>
      <section className="plan-summary"><div><span className="ai-badge"><Sparkles /> {selected.aiGenerated ? "OpenAI đề xuất" : "Thuật toán đề xuất"}</span><h2>{selected.summary}</h2></div><div><b>{selected.calorieTarget}</b><span>kcal / ngày</span></div></section>
      <section className="plan-insights" aria-label="Tổng quan kế hoạch">
        <article><span><CalendarDays /></span><div><small>Thời lượng</small><b>{selected.days.length} ngày</b></div></article>
        <article><span><Check /></span><div><small>Tiến độ bữa ăn</small><b>{completedMeals}/{planMeals.length} bữa</b></div></article>
        <article><span><ShoppingBasket /></span><div><small>Danh sách mua</small><b>{purchasedItems}/{selected.shoppingItems.length} món</b></div></article>
      </section>
      <div className="meal-plan-layout">
        <section className="week-section"><div className="week-heading"><div><span className="eyebrow">Lịch ăn trong tuần</span><h2>Mỗi ngày một lựa chọn ngon</h2></div><span className="week-progress">{Math.round((completedMeals / Math.max(planMeals.length, 1)) * 100)}% hoàn thành</span></div>
          <div className="week-grid">{selected.days.map((day, index) => <article className={`day-column ${format(new Date(day.date), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") ? "today" : ""}`} key={day.id}><header><div><span>{format(new Date(day.date), "EEEE", { locale: vi })}</span><b>{format(new Date(day.date), "dd 'tháng' MM")}</b></div>{index === 0 && <small>Bắt đầu</small>}<strong>{day.items.reduce((sum, item) => sum + item.calories, 0)} <small>kcal</small></strong></header><div className="day-meals">{day.items.map((item) => {
            const MealIcon = mealIcons[item.mealType];
            return <button key={item.id} className={`meal-card meal-${item.mealType.toLowerCase()} ${item.completed ? "done" : ""}`} onClick={() => toggleMeal.mutate({ id: item.id, completed: !item.completed })}><span className="meal-kind-icon"><MealIcon /></span><span className="meal-copy"><small>{mealLabels[item.mealType]}</small><strong>{item.recipe.name}</strong><span>{item.calories} kcal</span></span><span className="meal-check">{item.completed && <Check size={14} />}</span></button>;
          })}</div></article>)}</div>
        </section>
        <aside className="meal-plan-side"><section className="card shopping-section"><div className="section-title"><div><span className="eyebrow"><ShoppingBasket size={14} /> Tự động tổng hợp</span><h2>Danh sách mua sắm</h2></div><span>{purchasedItems}/{selected.shoppingItems.length}</span></div>{selected.shoppingItems.length ? <div className="shopping-grid">{selected.shoppingItems.map((item) => <label className={item.purchased ? "checked" : ""} key={item.id}><input type="checkbox" checked={item.purchased} onChange={() => toggleShop.mutate({ id: item.id, purchased: !item.purchased })} /><span><Check size={14} /></span><div><strong>{item.name}</strong><small>{item.quantity} {item.unit.toLowerCase()}</small></div></label>)}</div> : <p className="muted"><ListChecks size={18} /> Bạn đã có đủ nguyên liệu cho thực đơn này.</p>}</section></aside>
      </div>
    </>}
  </div>;
}
