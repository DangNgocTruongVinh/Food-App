import type { UseQueryResult } from "@tanstack/react-query";
import { Clock3, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { loginPath } from "../../features/auth/auth.logic";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { featuredRecipeFacts, featuredRecipeLink, landingCards, landingRecipeGroups, landingRecipeIntro } from "../../features/landing/landing.logic";
import { cx } from "../../features/ui/ui.logic";
import type { FeaturedRecipe, RecipeStats } from "../../types";
import { IMAGE_WIDTHS, isUploadedImageUrl } from "../../utils/images";
import { ButtonLink, EmptyState, ErrorState, RecipeImage, Skeleton, Tag } from "../ui";

type LandingRecipesProps = {
  stats: RecipeStats | undefined;
  featured: UseQueryResult<FeaturedRecipe[]>;
  /** Món đang làm ảnh hero: không lặp lại trong danh sách thẻ. */
  hero: FeaturedRecipe | null;
  signedIn: boolean;
};

/** Thẻ món: cả thẻ là vùng bấm (khách: sang đăng nhập rồi mở món). Ảnh chỉ hiện khi món có ảnh thật. */
function FeaturedRecipeCard({ recipe, signedIn }: { recipe: FeaturedRecipe; signedIn: boolean }) {
  const facts = featuredRecipeFacts(recipe);
  const photo = isUploadedImageUrl(recipe.imageUrl);
  return (
    <article className={cx("ld-recipe", photo && "ld-recipe--photo")}>
      {photo && <RecipeImage className="ld-recipe__image" recipe={recipe} width={IMAGE_WIDTHS.card} alt="" loading="lazy" />}
      <div className="ld-recipe__body">
        <h3 className="ld-recipe__title">
          <Link className="ld-recipe__link" to={featuredRecipeLink(recipe, signedIn)}>
            {recipe.name}
            {!signedIn && <span className="ui-visually-hidden">, đăng nhập để xem công thức</span>}
          </Link>
        </h3>
        <ul className="recipe-specs" aria-label="Thông tin món">
          <li><Clock3 aria-hidden="true" />{facts.minutes} phút</li>
          <li><Flame aria-hidden="true" />{formatNumber(facts.calories)} kcal</li>
        </ul>
        {facts.tags.length > 0 && <div className="recipe-tile__tags">{facts.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</div>}
      </div>
    </article>
  );
}

/** "Món trong Nouri": số thật từ /api/recipes/stats, món từ /api/recipes/featured. */
export function LandingRecipes({ stats, featured, hero, signedIn }: LandingRecipesProps) {
  const groups = landingRecipeGroups(stats);
  const cards = landingCards(featured.data ?? [], hero);
  return (
    <section id="mon-an" className="ld-section" aria-labelledby="ld-recipes-title">
      <div className="ld-section__inner">
        <div className="ld-recipes-head">
          <div className="ld-recipes-head__text">
            <h2 id="ld-recipes-title" className="ui-section-title">Món trong Nouri</h2>
            <p className="ld-text">{landingRecipeIntro(stats)}</p>
          </div>
          {groups.length > 0 && (
            <dl className="ld-groups" aria-label="Số món theo nhóm">
              {groups.map((group) => (
                <div key={group.key} className="ld-groups__item">
                  <dt>{group.label}</dt>
                  <dd className="ld-groups__count">{formatNumber(group.count)}<span className="ui-visually-hidden"> món</span></dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {featured.isLoading ? (
          <div className="ld-recipes" aria-busy="true" aria-label="Đang tải món">
            {[0, 1, 2].map((index) => <Skeleton key={index} kind="block" height={132} />)}
          </div>
        ) : featured.isError ? (
          <ErrorState message="Chưa tải được danh sách món." onRetry={() => void featured.refetch()} retrying={featured.isFetching} />
        ) : !cards.length ? (
          <EmptyState message="Chưa có món nào để giới thiệu." />
        ) : (
          <ul className="ld-recipes">
            {cards.map((recipe) => <li key={recipe.id}><FeaturedRecipeCard recipe={recipe} signedIn={signedIn} /></li>)}
          </ul>
        )}

        <div className="ld-recipes-foot">
          {!signedIn && <p className="ui-small">Đăng nhập để xem nguyên liệu, các bước làm và món nào hợp với hồ sơ của bạn.</p>}
          <ButtonLink to={signedIn ? "/recipes" : loginPath({ next: "/recipes" })}>Xem tất cả công thức</ButtonLink>
        </div>
      </div>
    </section>
  );
}
