import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  Apple, BadgeCheck, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleCheck, Clock3, Flame, Leaf, ListChecks, LoaderCircle, MoonStar, Plus,
  Search, ShoppingBasket, Soup, Sparkles, SunMedium, Target, Trash2, Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { getApiError } from "../api/client";
import { queryKeys } from "../api/query-keys";
import DateInput from "../components/DateInput";
import { EmptyState, LoadingState } from "../components/States";
import {
  alternativeMeals, featuredMealTypes, hasBalancedCalories, mealItemImage, mealLabels,
  latestMealPlanId, mealPlanDeleteConfirmMessage, mealPlanPath, mealPlanSuggestions, mealPlanTargets, mealShortLabels, mealTag, mealTimes,
  nextMealPlanIdAfterDelete, percentage, recipeSearchPath, selectMealPlanDay, summarizeMealPlan,
} from "../features/meal-plans/meal-plans.logic";
import {
  invalidateMealPlanQueries, mealPlanMutations, mealPlanQueries,
} from "../features/meal-plans/meal-plans.queries";
import { profileQueries } from "../features/profile/profile.queries";
import { recipeDetailPath } from "../features/recipes/recipes.logic";
import type { MealPlan } from "../types";
import { formatDayMonth, formatDisplayDate } from "../utils/date";

const mealIcons = { BREAKFAST: SunMedium, LUNCH: Soup, DINNER: MoonStar, SNACK: Apple };

type MealPlansLocationState = { notice?: string } | null;

export default function MealPlansPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const notice = (location.state as MealPlansLocationState)?.notice ?? "";

  const { data = [], isLoading } = useQuery(mealPlanQueries.list());
  const { data: profileData } = useQuery(profileQueries.detail());
  // Thực đơn đang chọn lấy từ URL và tải bằng GET /meal-plans/:id; dữ liệu đã có trong danh sách dùng làm dữ liệu ban đầu.
  const detail = useQuery({
    ...mealPlanQueries.detail(routeId ?? ""),
    enabled: Boolean(routeId),
    initialData: () => queryClient.getQueryData<MealPlan[]>(queryKeys.mealPlans.list())?.find((plan) => plan.id === routeId),
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.mealPlans.list())?.dataUpdatedAt,
  });
  const detailStatus = axios.isAxiosError(detail.error) ? detail.error.response?.status : undefined;

  // /meal-plans không kèm id → mở thực đơn mới nhất.
  useEffect(() => {
    if (!routeId && data.length) navigate(mealPlanPath(latestMealPlanId(data)), { replace: true, state: location.state });
  }, [data, location.state, navigate, routeId]);

  // Thực đơn không tồn tại hoặc không thuộc người dùng → báo ngắn và về thực đơn mới nhất còn lại.
  useEffect(() => {
    if (!routeId || (detailStatus !== 404 && detailStatus !== 422)) return;
    const fallbackId = nextMealPlanIdAfterDelete(data, routeId);
    navigate(mealPlanPath(fallbackId), { replace: true, state: { notice: "Không tìm thấy thực đơn này. Đã chuyển về thực đơn mới nhất." } });
  }, [data, detailStatus, navigate, routeId]);

  useEffect(() => setSelectedDayIndex(0), [routeId]);

  const selected = routeId ? detail.data ?? data.find((plan) => plan.id === routeId) : undefined;
  const selectedDay = selectMealPlanDay(selected, selectedDayIndex);
  const { planMeals, purchasedItems, nutrition, averages, completionRate } = useMemo(
    () => summarizeMealPlan(selected),
    [selected],
  );
  const targets = mealPlanTargets(profileData?.profile, selected);
  const nutritionScore = hasBalancedCalories(averages.calories, targets.calories);
  const snack = selectedDay?.items.find((item) => item.mealType === "SNACK");

  const generate = useMutation({
    ...mealPlanMutations.generate(startDate),
    onSuccess: (plan) => {
      invalidateMealPlanQueries(queryClient, true);
      navigate(mealPlanPath(plan.id));
      setError("");
    },
    onError: (err) => setError(getApiError(err)),
  });

  const toggleMeal = useMutation({
    ...mealPlanMutations.updateMeal(),
    onSuccess: () => invalidateMealPlanQueries(queryClient, true),
  });

  const toggleShop = useMutation({
    ...mealPlanMutations.updateShopping(),
    onSuccess: () => invalidateMealPlanQueries(queryClient, false),
  });

  const activate = useMutation({
    ...mealPlanMutations.updateStatus(),
    onSuccess: () => invalidateMealPlanQueries(queryClient, true),
  });

  const remove = useMutation({
    ...mealPlanMutations.remove(),
    onSuccess: (_result, deletedId) => {
      // Rời khỏi thực đơn đã xóa trước khi làm mới, để không gọi lại chi tiết của nó (sẽ 404).
      queryClient.removeQueries({ queryKey: queryKeys.mealPlans.detail(deletedId) });
      navigate(mealPlanPath(nextMealPlanIdAfterDelete(data, deletedId)), { replace: true });
      invalidateMealPlanQueries(queryClient, true);
      setError("");
    },
    onError: (err) => setError(getApiError(err)),
  });

  const confirmRemove = (plan: MealPlan) => {
    if (window.confirm(mealPlanDeleteConfirmMessage(plan))) remove.mutate(plan.id);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(recipeSearchPath(search));
  };

  if (isLoading || (routeId && !selected && detail.isLoading)) return <LoadingState />;

  return <div className="page reference-menu-page">
    <div className="menu-search-row">
      <form className="menu-global-search" onSubmit={submitSearch}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm món ăn, thực đơn..." /><kbd>⌘ K</kbd></form>
      <div className="menu-generate-controls"><DateInput aria-label="Ngày bắt đầu" value={startDate} onChange={setStartDate} /><button onClick={() => generate.mutate()} disabled={generate.isPending || !startDate}>{generate.isPending ? <LoaderCircle className="spin" /> : <Sparkles />}{generate.isPending ? "AI đang tạo..." : "Tạo thực đơn AI"}</button></div>
    </div>

    {error && <div className="form-error menu-page-error">{error}</div>}
    {notice && <div className="form-notice menu-page-error" role="status">{notice}</div>}

    {!selected ? <div className="menu-empty-shell"><section className="menu-hero menu-hero-empty"><div><span className="eyebrow"><Leaf /> Kế hoạch ăn uống thông minh</span><h1>Thực đơn</h1><p>Lên kế hoạch bữa ăn khoa học, tiết kiệm thời gian và dinh dưỡng mỗi ngày.</p><button onClick={() => generate.mutate()} disabled={generate.isPending || !startDate}><Sparkles /> Tạo thực đơn đầu tiên</button></div></section><EmptyState title="Chưa có thực đơn nào">Chọn ngày bắt đầu và để AI xây dựng kế hoạch ăn uống 7 ngày đầu tiên.</EmptyState></div> : <>
      <div className="menu-top-grid">
        <section className="menu-hero">
          <div><span className="eyebrow"><Leaf /> Kế hoạch ăn uống thông minh</span><h1>Thực đơn</h1><p>Lên kế hoạch bữa ăn khoa học, tiết kiệm thời gian<br />và dinh dưỡng mỗi ngày.</p><span className="menu-plan-note"><Sparkles /> {selected.summary || "Thực đơn được cá nhân hóa dựa trên mục tiêu của bạn."}</span></div>
        </section>

        <aside className="menu-week-summary">
          <header><div><span>Tổng quan tuần</span><h2>{formatDayMonth(selected.startDate)} – {formatDisplayDate(selected.endDate)}</h2></div><BadgeCheck /></header>
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
            <label className="menu-plan-select"><CalendarDays /><select value={selected.id} onChange={(event) => navigate(mealPlanPath(event.target.value))}>{data.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select><ChevronDown /></label>
            <strong>{formatDayMonth(selected.startDate)} – {formatDisplayDate(selected.endDate)}</strong>
            <div className="menu-toolbar-actions"><span className={`menu-plan-status ${selected.status.toLowerCase()}`}>{selected.status === "ACTIVE" ? "Đang áp dụng" : selected.status === "COMPLETED" ? "Đã hoàn thành" : "Bản nháp"}</span>{selected.status === "DRAFT" && <button className="menu-activate-button" onClick={() => activate.mutate({ id: selected.id, status: "ACTIVE" })} disabled={activate.isPending}><Check /> Áp dụng</button>}<Link to="/recipes"><Plus /> Thêm món</Link><button type="button" className="menu-delete-button" onClick={() => confirmRemove(selected)} disabled={remove.isPending}><Trash2 /> {remove.isPending ? "Đang xóa..." : "Xóa thực đơn"}</button></div>
          </header>

          <nav className="menu-day-tabs" aria-label="Chọn ngày trong tuần">{selected.days.map((day, index) => {
            const dayDate = new Date(day.date);
            const isWeekend = index >= 5;
            return <button key={day.id} className={`${selectedDayIndex === index ? "active" : ""} ${isWeekend ? "weekend" : ""}`} onClick={() => setSelectedDayIndex(index)}><strong>{format(dayDate, "EEEEEE", { locale: vi }).toUpperCase()}</strong><span>{formatDayMonth(dayDate)}</span></button>;
          })}</nav>

          <div className="menu-meal-columns">{featuredMealTypes.map((mealType, typeIndex) => {
            const MealIcon = mealIcons[mealType];
            const primary = selectedDay?.items.find((item) => item.mealType === mealType);
            const alternatives = alternativeMeals(selected, mealType, primary?.id);
            return <article className={`menu-meal-column menu-${mealType.toLowerCase()}`} key={mealType}>
              <header><span><MealIcon /></span><div><strong>{mealShortLabels[mealType]}</strong><small>{mealTimes[mealType]}</small></div><ChevronRight /></header>
              {primary ? <>
                <div className="menu-featured-image"><img src={mealItemImage(primary)} alt={primary.recipe.name} /><button className={primary.completed ? "completed" : ""} onClick={() => toggleMeal.mutate({ id: primary.id, completed: !primary.completed })} aria-label={primary.completed ? `Đánh dấu ${primary.recipe.name} chưa hoàn thành` : `Đánh dấu ${primary.recipe.name} hoàn thành`}><Check /></button></div>
                <div className="menu-featured-copy"><h2><Link to={recipeDetailPath(primary.recipe.id)}>{primary.recipe.name}</Link></h2><span><Clock3 /> {primary.recipe.prepMinutes + primary.recipe.cookMinutes} phút <i /> {primary.calories} kcal</span><div><b>{mealTag(primary)}</b><b className="secondary">{primary.completed ? "Đã dùng bữa" : "Dễ thực hiện"}</b></div></div>
                <div className="menu-alternative-list">{alternatives.map((item, index) => <button key={item.id} className={item.completed ? "completed" : ""} onClick={() => toggleMeal.mutate({ id: item.id, completed: !item.completed })}><img src={mealItemImage(item)} alt="" /><span><strong>{item.recipe.name}</strong><small><Clock3 /> {item.recipe.prepMinutes + item.recipe.cookMinutes} phút · {item.calories} kcal</small></span><i>{item.completed && <Check />}</i></button>)}</div>
              </> : <div className="menu-missing-meal"><Utensils /><p>Chưa có món cho {mealLabels[mealType].toLowerCase()}.</p><Link to="/recipes">Chọn món</Link></div>}
            </article>;
          })}</div>

          {snack && <div className="menu-snack-strip"><span><Apple /></span><div><small>Bữa phụ hôm nay</small><strong><Link to={recipeDetailPath(snack.recipe.id)}>{snack.recipe.name}</Link></strong></div><b>{snack.calories} kcal</b></div>}
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
            {mealPlanSuggestions(profileData?.profile, averages, targets).map((suggestion) => <article key={suggestion.key}><img src={suggestion.image} alt={suggestion.alt} /><p>{suggestion.text}</p></article>)}
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
