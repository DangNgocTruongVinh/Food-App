import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Apple, BadgeCheck, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleCheck, Clock3, Flame, Leaf, ListChecks, LoaderCircle, MoonStar, Plus,
  Search, ShoppingBasket, Soup, Sparkles, SunMedium, Target, Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getApiError } from "../api/client";
import { EmptyState, LoadingState } from "../components/States";
import type { MealPlan, MealPlanItem, MealType, ProfileResponse } from "../types";

const mealLabels: Record<MealType, string> = { BREAKFAST: "Bữa sáng", LUNCH: "Bữa trưa", DINNER: "Bữa tối", SNACK: "Bữa phụ" };
const mealShortLabels: Record<MealType, string> = { BREAKFAST: "Sáng", LUNCH: "Trưa", DINNER: "Tối", SNACK: "Bữa phụ" };
const mealTimes: Record<MealType, string> = { BREAKFAST: "07:00 – 09:00", LUNCH: "11:30 – 13:30", DINNER: "18:00 – 19:30", SNACK: "15:00 – 16:00" };
const mealIcons = { BREAKFAST: SunMedium, LUNCH: Soup, DINNER: MoonStar, SNACK: Apple };
const featuredMealTypes: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];
const recipeImages = ["/assets/recipe-oats.jpg", "/assets/recipe-vegan-bowl.jpg", "/assets/recipe-salmon.jpg"];

function mealImage(type: MealType, index = 0) {
  const base = type === "BREAKFAST" ? 0 : type === "LUNCH" ? 1 : type === "DINNER" ? 2 : 0;
  return recipeImages[(base + index) % recipeImages.length];
}

function mealTag(item: MealPlanItem) {
  if (item.recipe.dietTags[0]) return item.recipe.dietTags[0].replaceAll("_", " ");
  if (item.recipe.proteinG >= 25) return "Giàu protein";
  if (item.recipe.fatG <= 15) return "Ít chất béo";
  return "Cân bằng";
}

function percentage(value: number, target: number) {
  return Math.min(100, Math.round(value / Math.max(target, 1) * 100));
}

export default function MealPlansPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState("");
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const { data = [], isLoading } = useQuery({ queryKey: ["meal-plans"], queryFn: async () => (await api.get<MealPlan[]>("/meal-plans")).data });
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: async () => (await api.get<ProfileResponse>("/profile")).data });

  useEffect(() => { if (!selectedId && data.length) setSelectedId(data[0].id); }, [data, selectedId]);
  useEffect(() => setSelectedDayIndex(0), [selectedId]);

  const selected = data.find((plan) => plan.id === selectedId) ?? data[0];
  const selectedDay = selected?.days[selectedDayIndex] ?? selected?.days[0];
  const planMeals = useMemo(() => selected?.days.flatMap((day) => day.items) ?? [], [selected]);
  const completedMeals = planMeals.filter((item) => item.completed).length;
  const purchasedItems = selected?.shoppingItems.filter((item) => item.purchased).length ?? 0;

  const nutrition = useMemo(() => {
    const dayCount = Math.max(selected?.days.length ?? 0, 1);
    return planMeals.reduce((totals, item) => ({
      calories: totals.calories + item.calories,
      protein: totals.protein + item.recipe.proteinG,
      carbs: totals.carbs + item.recipe.carbsG,
      fat: totals.fat + item.recipe.fatG,
      fiber: totals.fiber + item.recipe.fiberG,
      dayCount: totals.dayCount,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, dayCount });
  }, [planMeals, selected?.days.length]);

  const averages = {
    calories: Math.round(nutrition.calories / nutrition.dayCount),
    protein: Math.round(nutrition.protein / nutrition.dayCount),
    carbs: Math.round(nutrition.carbs / nutrition.dayCount),
    fat: Math.round(nutrition.fat / nutrition.dayCount),
    fiber: Math.round(nutrition.fiber / nutrition.dayCount),
  };
  const targets = {
    calories: profileData?.profile?.dailyCalorieTarget ?? selected?.calorieTarget ?? 2000,
    protein: profileData?.profile?.proteinTargetG ?? 80,
    carbs: profileData?.profile?.carbTargetG ?? 250,
    fat: profileData?.profile?.fatTargetG ?? 65,
    fiber: 30,
  };
  const completionRate = Math.round(completedMeals / Math.max(planMeals.length, 1) * 100);
  const nutritionScore = Math.abs(averages.calories - targets.calories) <= targets.calories * .15;

  const generate = useMutation({
    mutationFn: async () => (await api.post<MealPlan>("/meal-plans/generate", { startDate })).data,
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSelectedId(plan.id);
      setError("");
    },
    onError: (err) => setError(getApiError(err)),
  });

  const toggleMeal = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => api.patch(`/meal-plans/items/${id}`, { completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const toggleShop = useMutation({
    mutationFn: ({ id, purchased }: { id: string; purchased: boolean }) => api.patch(`/meal-plans/shopping/${id}`, { purchased }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meal-plans"] }),
  });

  const activate = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Chưa chọn thực đơn");
      return api.patch(`/meal-plans/${selected.id}/status`, { status: "ACTIVE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/recipes${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ""}`);
  };

  if (isLoading) return <LoadingState />;

  return <div className="page reference-menu-page">
    <div className="menu-search-row">
      <form className="menu-global-search" onSubmit={submitSearch}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm món ăn, thực đơn..." /><kbd>⌘ K</kbd></form>
      <div className="menu-generate-controls"><input aria-label="Ngày bắt đầu" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><button onClick={() => generate.mutate()} disabled={generate.isPending}>{generate.isPending ? <LoaderCircle className="spin" /> : <Sparkles />}{generate.isPending ? "AI đang tạo..." : "Tạo thực đơn AI"}</button></div>
    </div>

    {error && <div className="form-error menu-page-error">{error}</div>}

    {!selected ? <div className="menu-empty-shell"><section className="menu-hero menu-hero-empty"><div><span className="eyebrow"><Leaf /> Kế hoạch ăn uống thông minh</span><h1>Thực đơn</h1><p>Lên kế hoạch bữa ăn khoa học, tiết kiệm thời gian và dinh dưỡng mỗi ngày.</p><button onClick={() => generate.mutate()} disabled={generate.isPending}><Sparkles /> Tạo thực đơn đầu tiên</button></div></section><EmptyState title="Chưa có thực đơn nào">Chọn ngày bắt đầu và để AI xây dựng kế hoạch ăn uống 7 ngày đầu tiên.</EmptyState></div> : <>
      <div className="menu-top-grid">
        <section className="menu-hero">
          <div><span className="eyebrow"><Leaf /> Kế hoạch ăn uống thông minh</span><h1>Thực đơn</h1><p>Lên kế hoạch bữa ăn khoa học, tiết kiệm thời gian<br />và dinh dưỡng mỗi ngày.</p><span className="menu-plan-note"><Sparkles /> {selected.summary || "Thực đơn được cá nhân hóa dựa trên mục tiêu của bạn."}</span></div>
        </section>

        <aside className="menu-week-summary">
          <header><div><span>Tổng quan tuần</span><h2>{format(new Date(selected.startDate), "dd/MM")} – {format(new Date(selected.endDate), "dd/MM/yyyy")}</h2></div><BadgeCheck /></header>
          <div className="menu-summary-grid">
            <article><span className="meals"><Utensils /></span><div><strong>{planMeals.length}</strong><small>Món ăn</small></div></article>
            <article><span className="calories"><Flame /></span><div><strong>{nutrition.calories.toLocaleString("vi-VN")}</strong><small>kcal</small></div></article>
            <article><span className="balanced"><CircleCheck /></span><div><strong>{nutritionScore ? "Đủ" : "Gần đủ"}</strong><small>Dinh dưỡng</small></div></article>
            <article><span className="progress"><Target /></span><div><strong>{completionRate}%</strong><small>Hoàn thành</small></div></article>
          </div>
        </aside>
      </div>

      <div className="menu-content-layout">
        <main className="menu-schedule-card">
          <header className="menu-week-toolbar">
            <div className="menu-week-nav"><button onClick={() => setSelectedDayIndex((value) => Math.max(0, value - 1))} disabled={selectedDayIndex === 0} aria-label="Ngày trước"><ChevronLeft /></button><button onClick={() => setSelectedDayIndex((value) => Math.min(selected.days.length - 1, value + 1))} disabled={selectedDayIndex === selected.days.length - 1} aria-label="Ngày sau"><ChevronRight /></button></div>
            <label className="menu-plan-select"><CalendarDays /><select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>{data.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><ChevronDown /></label>
            <strong>{format(new Date(selected.startDate), "dd")} – {format(new Date(selected.endDate), "dd/MM/yyyy")}</strong>
            <div className="menu-toolbar-actions"><span className={`menu-plan-status ${selected.status.toLowerCase()}`}>{selected.status === "ACTIVE" ? "Đang áp dụng" : selected.status === "COMPLETED" ? "Đã hoàn thành" : "Bản nháp"}</span>{selected.status === "DRAFT" && <button className="menu-activate-button" onClick={() => activate.mutate()} disabled={activate.isPending}><Check /> Áp dụng</button>}<Link to="/recipes"><Plus /> Thêm món</Link></div>
          </header>

          <nav className="menu-day-tabs" aria-label="Chọn ngày trong tuần">{selected.days.map((day, index) => {
            const dayDate = new Date(day.date);
            const isWeekend = index >= 5;
            return <button key={day.id} className={`${selectedDayIndex === index ? "active" : ""} ${isWeekend ? "weekend" : ""}`} onClick={() => setSelectedDayIndex(index)}><strong>{format(dayDate, "EEEEEE", { locale: vi }).toUpperCase()}</strong><span>{format(dayDate, "dd/MM")}</span></button>;
          })}</nav>

          <div className="menu-meal-columns">{featuredMealTypes.map((mealType, typeIndex) => {
            const MealIcon = mealIcons[mealType];
            const primary = selectedDay?.items.find((item) => item.mealType === mealType);
            const alternatives = selected.days.flatMap((day) => day.items).filter((item) => item.mealType === mealType && item.id !== primary?.id).slice(0, 2);
            return <article className={`menu-meal-column menu-${mealType.toLowerCase()}`} key={mealType}>
              <header><span><MealIcon /></span><div><strong>{mealShortLabels[mealType]}</strong><small>{mealTimes[mealType]}</small></div><ChevronRight /></header>
              {primary ? <>
                <div className="menu-featured-image"><img src={mealImage(mealType)} alt={primary.recipe.name} /><button className={primary.completed ? "completed" : ""} onClick={() => toggleMeal.mutate({ id: primary.id, completed: !primary.completed })} aria-label={primary.completed ? `Đánh dấu ${primary.recipe.name} chưa hoàn thành` : `Đánh dấu ${primary.recipe.name} hoàn thành`}><Check /></button></div>
                <div className="menu-featured-copy"><h2>{primary.recipe.name}</h2><span><Clock3 /> {primary.recipe.prepMinutes + primary.recipe.cookMinutes} phút <i /> {primary.calories} kcal</span><div><b>{mealTag(primary)}</b><b className="secondary">{primary.completed ? "Đã dùng bữa" : "Dễ thực hiện"}</b></div></div>
                <div className="menu-alternative-list">{alternatives.map((item, index) => <button key={item.id} className={item.completed ? "completed" : ""} onClick={() => toggleMeal.mutate({ id: item.id, completed: !item.completed })}><img src={mealImage(mealType, index + 1)} alt="" /><span><strong>{item.recipe.name}</strong><small><Clock3 /> {item.recipe.prepMinutes + item.recipe.cookMinutes} phút · {item.calories} kcal</small></span><i>{item.completed && <Check />}</i></button>)}</div>
              </> : <div className="menu-missing-meal"><Utensils /><p>Chưa có món cho {mealLabels[mealType].toLowerCase()}.</p><Link to="/recipes">Chọn món</Link></div>}
            </article>;
          })}</div>

          {selectedDay?.items.some((item) => item.mealType === "SNACK") && <div className="menu-snack-strip"><span><Apple /></span><div><small>Bữa phụ hôm nay</small><strong>{selectedDay.items.find((item) => item.mealType === "SNACK")?.recipe.name}</strong></div><b>{selectedDay.items.find((item) => item.mealType === "SNACK")?.calories} kcal</b></div>}
          <Link className="menu-add-meal" to="/recipes"><Plus /> Thêm món vào thực đơn</Link>
        </main>

        <aside className="menu-side-column">
          <section className="menu-nutrition-card">
            <header><div><span>Dinh dưỡng trung bình</span><h2>Mỗi ngày</h2></div><BadgeCheck /></header>
            <div className="menu-nutrition-bars">
              <div><header><span>Năng lượng</span><b>{averages.calories.toLocaleString("vi-VN")} / {targets.calories.toLocaleString("vi-VN")} kcal</b></header><div><span className="energy" style={{ width: `${percentage(averages.calories, targets.calories)}%` }} /></div></div>
              <div><header><span>Protein</span><b>{averages.protein} / {targets.protein} g</b></header><div><span className="protein" style={{ width: `${percentage(averages.protein, targets.protein)}%` }} /></div></div>
              <div><header><span>Tinh bột</span><b>{averages.carbs} / {targets.carbs} g</b></header><div><span className="carbs" style={{ width: `${percentage(averages.carbs, targets.carbs)}%` }} /></div></div>
              <div><header><span>Chất béo</span><b>{averages.fat} / {targets.fat} g</b></header><div><span className="fat" style={{ width: `${percentage(averages.fat, targets.fat)}%` }} /></div></div>
              <div><header><span>Chất xơ</span><b>{averages.fiber} / {targets.fiber} g</b></header><div><span className="fiber" style={{ width: `${percentage(averages.fiber, targets.fiber)}%` }} /></div></div>
            </div>
            <Link to="/profile">Xem mục tiêu dinh dưỡng <ChevronRight /></Link>
          </section>

          <section className="menu-suggestion-card">
            <header><Sparkles /><h2>Gợi ý cho bạn</h2></header>
            <article><img src="/assets/recipe-vegan-bowl.jpg" alt="Rau xanh" /><p>{averages.fiber < targets.fiber ? "Thêm 1–2 khẩu phần rau xanh mỗi ngày để cân bằng dinh dưỡng." : "Lượng chất xơ tuần này đang ở mức cân bằng tốt."}</p></article>
            <article><img src="/assets/recipe-salmon.jpg" alt="Cá hồi" /><p>{averages.fat > targets.fat ? "Ưu tiên chất béo tốt và giảm các món chiên trong những ngày tới." : "Bổ sung cá béo giúp đa dạng nguồn Omega-3 trong tuần."}</p></article>
          </section>

          <section className="menu-shopping-card">
            <header><div><span>Danh sách mua sắm</span><h2>{purchasedItems}/{selected.shoppingItems.length} đã mua</h2></div><ShoppingBasket /></header>
            {selected.shoppingItems.length ? <div>{selected.shoppingItems.map((item) => <label className={item.purchased ? "checked" : ""} key={item.id}><input type="checkbox" checked={item.purchased} onChange={() => toggleShop.mutate({ id: item.id, purchased: !item.purchased })} /><span><Check /></span><p><strong>{item.name}</strong><small>{item.quantity} {item.unit.toLowerCase()}</small></p></label>)}</div> : <p className="menu-shopping-empty"><ListChecks /> Bạn đã có đủ nguyên liệu.</p>}
          </section>

          <section className="menu-optimize-card"><CalendarDays /><p>Dựa trên thực phẩm trong kho để gợi ý thực đơn tối ưu.</p><Link to="/assistant">Tối ưu thực đơn <Sparkles /></Link></section>
        </aside>
      </div>
    </>}
  </div>;
}
