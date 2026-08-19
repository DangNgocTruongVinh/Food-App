import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { vi } from "date-fns/locale";
import { ArrowRight, CalendarCheck, Check, Clock3, Flame, Heart, PackageCheck, PackageOpen, Search, Sparkles, TimerReset } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import type { DashboardData, MealType } from "../types";

const mealLabels: Record<MealType, string> = { BREAKFAST: "Sáng", LUNCH: "Trưa", DINNER: "Tối", SNACK: "Bữa phụ" };

const mealImage = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("yến mạch") || normalized.includes("sữa chua") || normalized.includes("chuối")) return "/assets/recipe-oats.jpg";
  if (normalized.includes("cá") || normalized.includes("tôm") || normalized.includes("ngừ")) return "/assets/recipe-salmon.jpg";
  if (normalized.includes("đậu") || normalized.includes("rau") || normalized.includes("nấm") || normalized.includes("bowl")) return "/assets/recipe-vegan-bowl.jpg";
  return "/assets/nutrition-hero.jpg";
};

const foodEmoji = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("gà") || normalized.includes("thịt")) return "🍗";
  if (normalized.includes("cá") || normalized.includes("tôm")) return "🐟";
  if (normalized.includes("trứng")) return "🥚";
  if (normalized.includes("khoai")) return "🍠";
  return "🥦";
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await api.get<DashboardData>("/dashboard")).data });
  if (isLoading) return <LoadingState />;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (search.trim()) navigate(`/recipes?q=${encodeURIComponent(search.trim())}`);
  };
  const todayMeals = data?.todayMeals ?? [];
  const recommendedRecipes = data?.recommendedRecipes ?? [];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const firstName = user?.name?.split(" ").at(-1) ?? "bạn";

  return <div className="page reference-dashboard">
    <section className="overview-welcome">
      <div className="overview-hero-backgrounds" aria-hidden="true"><span className="overview-hero-image" /></div>
      <div className="overview-welcome-copy"><div className="overview-greeting-copy"><span className="eyebrow">{format(new Date(), "EEEE, dd 'tháng' M", { locale: vi })}</span><h1><span className="overview-greeting-fixed">{greeting},</span>{" "}<span className="overview-greeting-person"><strong>{firstName}!</strong> <span className="overview-wave" aria-hidden="true">👋</span></span></h1><p>Hôm nay bạn muốn nấu món gì ngon?</p></div><form className="overview-search" onSubmit={submitSearch}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm món ăn, nguyên liệu..." aria-label="Tìm kiếm món ăn hoặc nguyên liệu" /><button aria-label="Tìm kiếm"><Sparkles /></button></form></div>
      <div className="overview-calorie-chip"><span><Flame /></span><div><b>{data?.nutritionTargets?.calories ?? "—"}</b><small>kcal mục tiêu</small></div></div>
    </section>

    <section className="overview-metrics" aria-label="Thông tin tổng quan">
      <article><span className="overview-metric-icon stock"><PackageOpen /></span><div><strong>{data?.pantryCount ?? 0}</strong><b>Thực phẩm</b><small>Trong kho</small></div></article>
      <article><span className="overview-metric-icon soon"><TimerReset /></span><div><strong>{data?.expiringItems.length ?? 0}</strong><b>Sắp hết hạn</b><small>Cần dùng sớm</small></div></article>
      <article><span className="overview-metric-icon expired"><PackageCheck /></span><div><strong>{data?.expiredCount ?? 0}</strong><b>Đã hết hạn</b><small>Kiểm tra ngay</small></div></article>
      <article><span className="overview-metric-icon meals"><Heart /></span><div><strong>{todayMeals.length}</strong><b>Bữa hôm nay</b><small>Đã lên lịch</small></div></article>
      <article className="overview-savings-metric"><div><span>Tiết kiệm tháng này</span><small>↑ 18%</small><b>450.000đ</b><em>so với tháng trước</em></div><svg viewBox="0 0 110 48" role="img" aria-label="Xu hướng tiết kiệm tăng 18 phần trăm"><path className="saving-area" d="M2 40 C14 31, 22 42, 32 31 S47 5, 59 10 S72 38, 84 28 S98 22, 108 15 L108 48 L2 48 Z" /><path className="saving-line" d="M2 40 C14 31, 22 42, 32 31 S47 5, 59 10 S72 38, 84 28 S98 22, 108 15" /></svg></article>
    </section>

    <section className="overview-panels">
      <article className="overview-panel overview-expiry"><header><h2>Sắp hết hạn</h2><Link to="/pantry">Xem tất cả</Link></header>{data?.expiringItems.length ? <div>{data.expiringItems.slice(0, 4).map((item) => { const days = Math.max(0, differenceInCalendarDays(new Date(item.expiryDate!), new Date())); return <div className="overview-expiry-row" key={item.id}><span className="overview-food-thumb" aria-hidden="true">{foodEmoji(item.name)}</span><div><strong>{item.name}</strong><small>{item.quantity} {item.unit.toLowerCase()}</small></div><span>HSD: {format(new Date(item.expiryDate!), "dd/MM")}</span><b>{days} ngày</b></div>; })}</div> : <div className="overview-compact-empty"><PackageCheck /><p>Kho thực phẩm đang được kiểm soát tốt.</p></div>}</article>

      <article className="overview-panel overview-recommendations"><header><h2>Gợi ý món ăn cho bạn</h2><Link to="/recipes">Xem tất cả</Link></header>{recommendedRecipes.length ? <div className="overview-recipe-grid">{recommendedRecipes.map((recipe) => <Link to="/recipes" className="overview-recipe-card" key={recipe.id}><div><img src={mealImage(recipe.name)} alt="" /><span><Clock3 /> {recipe.prepMinutes + recipe.cookMinutes} phút</span></div><h3>{recipe.name}</h3><footer><small>{recipe.dietTags.includes("VEGETARIAN") ? "Món chay" : "Cân bằng"}</small><span><Flame /> {recipe.calories} kcal</span></footer></Link>)}</div> : <div className="overview-compact-empty"><Sparkles /><p>Chưa có công thức để đề xuất.</p></div>}</article>

      <article className="overview-panel overview-today"><header><div><h2>Kế hoạch hôm nay</h2><span>{format(new Date(), "EEEE, dd/MM", { locale: vi })}</span></div><CalendarCheck /></header>{todayMeals.length ? <div className="overview-today-list">{todayMeals.slice(0, 4).map((item) => <div className={item.completed ? "completed" : ""} key={item.id}><span className="overview-meal-time">{mealLabels[item.mealType]}</span><img src={mealImage(item.recipe.name)} alt="" /><div><strong>{item.recipe.name}</strong><small><Clock3 /> {item.recipe.prepMinutes + item.recipe.cookMinutes} phút</small></div><span className="overview-meal-check">{item.completed && <Check />}</span></div>)}</div> : <div className="overview-compact-empty"><CalendarCheck /><p>Chưa có bữa ăn cho hôm nay.</p></div>}<Link className="overview-outline-button" to="/meal-plans">Xem kế hoạch chi tiết <ArrowRight /></Link></article>
    </section>

    <section className="overview-ai-banner"><img className="overview-ai-mascot" src="/assets/ai-mascot.png" alt="Trợ lý dinh dưỡng NOURI AI" /><div><span className="eyebrow">AI gợi ý cho bạn <Sparkles /></span><h2>Bạn muốn ăn gì hôm nay?</h2><div className="overview-ai-prompts"><Link to="/assistant">Món dưới 30 phút</Link><Link to="/assistant">Món ít calo</Link><Link to="/assistant">Tận dụng thực phẩm sắp hết hạn</Link><Link to="/assistant">Thực đơn 3 ngày</Link></div></div><Link className="button primary" to="/assistant">Hỏi AI ngay <ArrowRight /></Link></section>
  </div>;
}
