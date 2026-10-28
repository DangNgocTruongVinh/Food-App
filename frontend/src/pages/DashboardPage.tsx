import { useGSAP } from "@gsap/react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import gsap from "gsap";
import { AlertTriangle, ArrowRight, Bookmark, CalendarCheck, Check, Clock3, Droplet, Flame, Hand, Leaf, PackageOpen, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import {
  buildDashboardViewModel,
  dashboardMealIcon as getMealIcon,
  dashboardMealImage as mealImage,
  dashboardMealLabels as mealLabels,
  dashboardMealTimes as overviewMealTimes,
  dashboardRecipeSearchPath,
  dashboardSuggestionImages as overviewSuggestionImages,
  dashboardWaterLiters,
} from "../features/dashboard/dashboard.logic";
import { dashboardQueries } from "../features/dashboard/dashboard.queries";

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pageRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [waterGlasses, setWaterGlasses] = useState(5);
  const { data, isLoading } = useQuery(dashboardQueries.overview());

  useGSAP(() => {
    if (isLoading || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".overview-v2-hero-copy > *", { y: 18, autoAlpha: 0, duration: 0.62, stagger: 0.07 })
      .from(".overview-v2-hero-bowl", { scale: 0.88, rotation: 5, autoAlpha: 0, duration: 0.92 }, 0.08)
      .from(".overview-v2-hero-leaf, .overview-v2-lemon-cup", { y: 12, scale: 0.82, autoAlpha: 0, duration: 0.58, stagger: 0.06 }, 0.22)
      .from(".overview-v2-metric", { y: 16, autoAlpha: 0, duration: 0.46, stagger: 0.06 }, 0.3)
      .from(".overview-v2-insight, .overview-v2-panel, .overview-v2-water-strip", { y: 22, autoAlpha: 0, duration: 0.58, stagger: 0.08 }, 0.5);

    return () => intro.kill();
  }, { scope: pageRef, dependencies: [isLoading], revertOnUpdate: true });

  if (isLoading) return <LoadingState />;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const path = dashboardRecipeSearchPath(search);
    if (path) navigate(path);
  };

  const {
    todayMeals,
    recommendedRecipes,
    expiringItems,
    greeting,
    firstName,
    calorieTarget,
    consumedCalories,
    calorieProgress,
    completedMeals,
    mealProgress,
    insightItems,
    insightTitle,
  } = buildDashboardViewModel(data, user?.name);
  const waterLiters = dashboardWaterLiters(waterGlasses);

  return <div className="page reference-dashboard overview-dashboard-v2" ref={pageRef}>
    <section className="overview-v2-hero" aria-labelledby="overview-v2-title">
      <div className="overview-v2-hero-copy">
        <time dateTime={format(new Date(), "yyyy-MM-dd")}>{format(new Date(), "EEEE, dd 'tháng' M", { locale: vi })}</time>
        <h1 id="overview-v2-title">{greeting},<br /><strong>{firstName}!</strong> <Hand aria-hidden="true" /></h1>
        <p>Nouri luôn sẵn sàng đồng hành cùng bạn trên hành trình sống khỏe mỗi ngày.</p>
        <form className="overview-v2-search" onSubmit={submitSearch}>
          <Search aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm món ăn, nguyên liệu, công thức..." aria-label="Tìm kiếm món ăn, nguyên liệu hoặc công thức" />
          <button type="submit" aria-label="Mở tìm kiếm nâng cao"><SlidersHorizontal /></button>
        </form>
      </div>

      <div className="overview-v2-hero-visual" aria-hidden="true">
        <Leaf className="overview-v2-hero-leaf leaf-one" />
        <Leaf className="overview-v2-hero-leaf leaf-two" />
        <Leaf className="overview-v2-hero-leaf leaf-three" />
        <span className="overview-v2-lemon-cup"><i /></span>
        <img className="overview-v2-hero-bowl" src="/assets/dashboard-hero-salmon-bowl-v4.png" alt="" />
      </div>
    </section>

    <section className="overview-v2-today" aria-labelledby="overview-v2-today-title">
      <header><h2 id="overview-v2-today-title">Hôm nay của bạn</h2><Leaf aria-hidden="true" /></header>
      <div className="overview-v2-metrics">
        <article className="overview-v2-metric urgent">
          <span className="overview-v2-metric-icon"><AlertTriangle /></span>
          <strong>{expiringItems.length}</strong>
          <div><b>nguyên liệu</b><small>nên dùng sớm</small></div>
          <Link to="/pantry">Xem chi tiết <ArrowRight /></Link>
        </article>

        <article className="overview-v2-metric">
          <span className="overview-v2-metric-icon pantry"><PackageOpen /></span>
          <strong>{data?.pantryCount ?? 0}</strong>
          <div><b>nguyên liệu</b><small>trong kho</small></div>
        </article>

        <article className="overview-v2-metric">
          <span className="overview-v2-metric-icon meals"><CalendarCheck /></span>
          <strong>{todayMeals.length}</strong>
          <div><b>bữa ăn</b><small>hôm nay</small></div>
        </article>

        <article className="overview-v2-metric calories">
          <span className="overview-v2-metric-icon energy"><Flame /></span>
          <div className="overview-v2-calorie-copy"><strong>{consumedCalories}</strong><b>/ {calorieTarget} kcal</b></div>
          <div className="overview-v2-progress"><span style={{ width: `${calorieProgress}%` }} /></div>
          <small>{calorieProgress}%</small>
        </article>
      </div>
    </section>

    <section className="overview-v2-insight" aria-labelledby="overview-v2-insight-title">
      <div className="overview-v2-insight-heading"><h2 id="overview-v2-insight-title">Nouri Insight</h2><Sparkles /></div>
      <img className="overview-v2-insight-ingredients" src="/assets/dashboard-insight-ingredients-v4.png" alt="" />
      <div className="overview-v2-insight-copy">
        <span>Gợi ý thông minh cho bạn</span>
        <h3>{insightTitle}</h3>
        <p>{insightItems.length ? "sắp hết hạn. Nouri gợi ý món ngon sử dụng cả hai để tránh lãng phí nhé." : "Hãy tiếp tục duy trì thói quen sử dụng nguyên liệu tươi và lên kế hoạch bữa ăn đều đặn."}</p>
        <Link to="/assistant">Xem gợi ý món <ArrowRight /></Link>
      </div>
      <div className="overview-v2-insight-dish"><img src="/assets/dashboard-insight-chicken-bowl-v4.jpg" alt="Bowl gà quinoa Nouri đề xuất" /></div>
    </section>

    <section className="overview-v2-main-grid">
      <article className="overview-v2-panel overview-v2-suggestions">
        <header>
          <div><h2>Gợi ý riêng cho bạn <Sparkles /></h2><p>Dựa trên nguyên liệu trong kho và khẩu vị của bạn</p></div>
          <Link to="/recipes">Xem tất cả <ArrowRight /></Link>
        </header>
        <div className="overview-v2-recipe-grid">
          {recommendedRecipes.map((recipe, index) => <article className="overview-v2-recipe-card" key={recipe.id}>
            <Link className="overview-v2-recipe-image" to="/recipes"><img src={overviewSuggestionImages[index] ?? mealImage(recipe.name)} alt={recipe.name} /></Link>
            <button type="button" aria-label={`Lưu ${recipe.name}`}><Bookmark /></button>
            <div><Link to="/recipes"><h3>{recipe.name}</h3></Link><small><Leaf /> Dùng nguyên liệu trong kho</small><footer><span><Clock3 /> {recipe.prepMinutes + recipe.cookMinutes} phút</span><span><Flame /> {recipe.calories} kcal</span></footer></div>
          </article>)}
        </div>
        <div className="overview-v2-dots" aria-hidden="true"><i className="active" /><i /><i /></div>
      </article>

      <article className="overview-v2-panel overview-v2-plan">
        <header><div><h2>Kế hoạch hôm nay</h2><p>Hoàn thành {completedMeals}/{todayMeals.length || 3} bữa</p></div><CalendarCheck /></header>
        <div className="overview-v2-plan-progress"><span style={{ width: `${mealProgress}%` }} /><small>{mealProgress}%</small></div>
        {todayMeals.length ? <div className="overview-v2-meal-list">
          {todayMeals.slice(0, 3).map((item) => {
            const MealIcon = getMealIcon(item.mealType);
            return <div className={item.completed ? "completed" : ""} key={item.id}>
              <MealIcon className="overview-v2-meal-period" />
              <time>{overviewMealTimes[item.mealType]}<small>{mealLabels[item.mealType]}</small></time>
              <img src={mealImage(item.recipe.name)} alt="" />
              <div><strong>{item.recipe.name}</strong><small>{item.recipe.prepMinutes + item.recipe.cookMinutes} phút</small></div>
              <span className="overview-v2-meal-status">{item.completed && <Check />}</span>
            </div>;
          })}
        </div> : <div className="overview-v2-meal-empty"><CalendarCheck /><p>Chưa có bữa ăn hôm nay. Hãy để Nouri lên lịch giúp bạn.</p></div>}
        <Link className="overview-v2-plan-link" to="/meal-plans">Xem thực đơn đầy đủ <ArrowRight /></Link>
      </article>
    </section>

    <section className="overview-v2-water-strip" aria-label="Theo dõi lượng nước">
      <div className="overview-v2-tip">
        <img src="/assets/ai-mascot.png" alt="Nouri" />
        <div><h2>Nouri Tip <Sparkles /></h2><p>Uống đủ 1.5 – 2L nước mỗi ngày giúp cơ thể trao đổi chất tốt hơn và làn da khỏe đẹp.</p></div>
      </div>
      <div className="overview-v2-hydration">
        <div><p>Bạn đã uống <strong>{waterLiters}L / 2L</strong></p><div className="overview-v2-drops">{Array.from({ length: 8 }, (_, index) => <Droplet className={index < waterGlasses ? "filled" : ""} key={index} />)}</div></div>
        <button type="button" onClick={() => setWaterGlasses((value) => Math.min(8, value + 1))} disabled={waterGlasses >= 8}>Ghi nhận nước <ArrowRight /></button>
      </div>
    </section>
  </div>;
}
