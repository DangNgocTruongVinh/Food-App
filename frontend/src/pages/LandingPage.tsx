import { useQuery } from "@tanstack/react-query";
import { LandingCommunity } from "../components/landing/LandingCommunity";
import { LandingFeatures } from "../components/landing/LandingFeatures";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingHeader } from "../components/landing/LandingHeader";
import { LandingHero } from "../components/landing/LandingHero";
import { LandingRecipes } from "../components/landing/LandingRecipes";
import { LandingSignup } from "../components/landing/LandingSignup";
import { LandingSteps } from "../components/landing/LandingSteps";
import { useAuth } from "../contexts/AuthContext";
import { LANDING_FEATURED_LIMIT } from "../features/landing/landing.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";

/**
 * Trang chủ cho khách (/): DESIGN.md mục 14 "Landing". Số liệu và món lấy từ hai endpoint công khai
 * GET /api/recipes/stats và GET /api/recipes/featured; không có số minh họa, không hiệu ứng khi cuộn.
 * Làm lại 10/11/2026: màu thương hiệu --home-*, chỉ Be Vietnam Pro, header và footer riêng của trang chủ (CSS: landing.css).
 */
export default function LandingPage() {
  const signedIn = Boolean(useAuth().user);
  const stats = useQuery(recipeQueries.stats());
  const featured = useQuery(recipeQueries.featured(LANDING_FEATURED_LIMIT));

  return (
    <div className="ld-root">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <LandingHeader signedIn={signedIn} />
      <main id="noi-dung-chinh" tabIndex={-1} className="ld-page">
        <LandingHero signedIn={signedIn} />
        <LandingFeatures signedIn={signedIn} />
        <LandingRecipes stats={stats.data} featured={featured} signedIn={signedIn} />
        <LandingSteps />
        <LandingCommunity signedIn={signedIn} />
        <LandingSignup signedIn={signedIn} />
      </main>
      <LandingFooter signedIn={signedIn} />
    </div>
  );
}
