import { useGSAP } from "@gsap/react";
import { useQuery } from "@tanstack/react-query";
import gsap from "gsap";
import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import InsightCard from "../components/dashboard/InsightCard";
import OverviewHero from "../components/dashboard/OverviewHero";
import RecommendedRecipes from "../components/dashboard/RecommendedRecipes";
import TodayMetrics from "../components/dashboard/TodayMetrics";
import TodayPlanCard from "../components/dashboard/TodayPlanCard";
import WaterStrip from "../components/dashboard/WaterStrip";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import { buildDashboardViewModel, dashboardRecipeSearchPath, nextWaterGlasses } from "../features/dashboard/dashboard.logic";
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

  const view = buildDashboardViewModel(data, user?.name);

  return <div className="page reference-dashboard overview-dashboard-v2" ref={pageRef}>
    <OverviewHero greeting={view.greeting} firstName={view.firstName} search={search} onSearchChange={setSearch} onSearchSubmit={submitSearch} />

    <TodayMetrics
      expiringCount={view.expiringItems.length} pantryCount={data?.pantryCount ?? 0} mealCount={view.todayMeals.length}
      consumedCalories={view.consumedCalories} calorieTarget={view.calorieTarget} calorieProgress={view.calorieProgress}
    />

    <InsightCard title={view.insightTitle} hasExpiringItems={view.insightItems.length > 0} />

    <section className="overview-v2-main-grid">
      <RecommendedRecipes recipes={view.recommendedRecipes} areRealRecipes={view.hasRealRecommendedRecipes} />
      <TodayPlanCard meals={view.todayMeals} completedMeals={view.completedMeals} mealProgress={view.mealProgress} />
    </section>

    <WaterStrip glasses={waterGlasses} onAddGlass={() => setWaterGlasses(nextWaterGlasses)} />
  </div>;
}
