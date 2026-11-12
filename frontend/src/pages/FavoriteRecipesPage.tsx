import { useQuery } from "@tanstack/react-query";
import { RecipeCard } from "../components/recipes/RecipeCard";
import { RecipeBackLink } from "../components/recipes/RecipeDetailStates";
import { ButtonLink, EmptyState, ErrorState, LoadingState, Skeleton } from "../components/ui";
import { recipeQueries } from "../features/recipes/recipes.queries";

/** /recipes/favorites (UC24): món yêu thích của bạn, mới thêm trước; bỏ trái tim là món rời khỏi danh sách. */
export default function FavoriteRecipesPage() {
  const favorites = useQuery(recipeQueries.favorites());
  return (
    <div className="recipe-detail recipes-favorites">
      <RecipeBackLink />
      <header className="recipes-favorites__head">
        <h1 className="ui-title">Món yêu thích</h1>
        <p className="ui-text">Món bạn đánh dấu trái tim. Nouri cũng dùng các món này để gợi ý món hợp khẩu vị hơn.</p>
      </header>
      {favorites.isLoading ? (
        <LoadingState label="Đang tải món yêu thích"><Skeleton kind="block" height={280} /></LoadingState>
      ) : favorites.isError ? (
        <ErrorState message="Chưa tải được món yêu thích." onRetry={() => void favorites.refetch()} retrying={favorites.isFetching} />
      ) : !favorites.data?.length ? (
        <EmptyState
          message="Bạn chưa yêu thích món nào. Bấm trái tim trên thẻ món hoặc ở trang chi tiết món."
          action={<ButtonLink to="/recipes">Xem công thức</ButtonLink>}
        />
      ) : (
        <ul className="recipes-results__list recipes-results__list--grid" aria-label="Món yêu thích">
          {favorites.data.map((recipe) => <li key={recipe.id}><RecipeCard recipe={recipe} layout="grid" /></li>)}
        </ul>
      )}
    </div>
  );
}
