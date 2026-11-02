import { useQuery } from "@tanstack/react-query";
import { LandingBenefits } from "../components/landing/LandingBenefits";
import { LandingCommunity } from "../components/landing/LandingCommunity";
import { LandingHeader } from "../components/landing/LandingHeader";
import { LandingHero } from "../components/landing/LandingHero";
import { LandingRecipes } from "../components/landing/LandingRecipes";
import { LandingSignup } from "../components/landing/LandingSignup";
import { LandingSteps } from "../components/landing/LandingSteps";
import { SiteFooter } from "../components/layout/SiteFooter";
import { useAuth } from "../contexts/AuthContext";
import { heroPhotoRecipe, LANDING_FEATURED_LIMIT } from "../features/landing/landing.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";

/**
 * Trang chủ cho khách (/): DESIGN.md mục 14 "Landing". Số liệu và món lấy từ hai endpoint công khai
 * GET /api/recipes/stats và GET /api/recipes/featured; không có số minh họa, không hiệu ứng khi cuộn.
 */
export default function LandingPage() {
  const signedIn = Boolean(useAuth().user);
  const stats = useQuery(recipeQueries.stats());
  const featured = useQuery(recipeQueries.featured(LANDING_FEATURED_LIMIT));
  const hero = heroPhotoRecipe(featured.data);

  return (
    <div className="ui-shell">
      <a className="ui-skip-link" href="#noi-dung-chinh">Bỏ qua menu, tới nội dung</a>
      <LandingHeader signedIn={signedIn} />
      <main id="noi-dung-chinh" tabIndex={-1} className="ui-shell__main ld-page">
        <LandingHero signedIn={signedIn} photo={hero} />
        <LandingBenefits />
        <LandingRecipes stats={stats.data} featured={featured} hero={hero} signedIn={signedIn} />
        <LandingSteps />
        <LandingCommunity signedIn={signedIn} />
        <LandingSignup signedIn={signedIn} />
      </main>
      <SiteFooter />
    </div>
  );
}
