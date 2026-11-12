import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecipeCategoryChips } from "../components/recipes/RecipeCategoryChips";
import { RecipeResults } from "../components/recipes/RecipeResults";
import { RecipesForYou } from "../components/recipes/RecipesForYou";
import { RecipesHero } from "../components/recipes/RecipesHero";
import { RecipesSkeleton } from "../components/recipes/RecipesSkeleton";
import { ErrorState } from "../components/ui";
import {
  filterAndSortRecipes, paginateRecipes, recipeSearchView, recipeTotalText, type RecipeCategory, type RecipeSort,
} from "../features/recipes/recipes.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";
import { recommendationQueries } from "../features/recommendations/recommendations.api";

const PAGE_SIZE = 8;

// Nút yêu thích của trang cũ chỉ là state cục bộ (mất khi tải lại) nên tạm ẩn; lưu DB ở GĐ5 (FavoriteRecipe).
export default function RecipesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState<RecipeCategory>("all");
  const [sort, setSort] = useState<RecipeSort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [pageIndex, setPageIndex] = useState(1);
  const [showAll, setShowAll] = useState(false);

  const list = useQuery(recipeQueries.list());
  // "Dành cho bạn": bộ gợi ý, ngữ cảnh for-you (khẩu vị là chính); món lớn đối chiếu thêm kho/hồ sơ.
  const suggestions = useQuery(recommendationQueries.list({ context: "for-you", limit: 3 }));
  const recommendations = suggestions.data?.items ?? [];
  const featuredId = recommendations[0]?.recipe.id ?? "";
  const featuredFit = useQuery({ ...recipeQueries.forYou(featuredId), enabled: Boolean(featuredId) });

  const data = list.data ?? [];
  // Món vi phạm dị ứng/chế độ ăn ẩn mặc định; số trên ô lọc tính trên kết quả tìm của danh sách đang hiện.
  const { profileView, counts, hiddenMatches } = useMemo(() => recipeSearchView(data, search, showAll), [data, search, showAll]);
  const recipes = useMemo(() => filterAndSortRecipes(profileView.recipes, { search, category, sort }), [category, profileView, search, sort]);
  const recipesById = useMemo(() => new Map(data.map((recipe) => [recipe.id, recipe])), [data]);

  if (list.isLoading) return <RecipesSkeleton />;
  if (list.isError) {
    return (
      <div className="recipes-view">
        <div className="recipes-content recipes-content--error">
          <ErrorState message="Chưa tải được danh sách công thức." onRetry={() => void list.refetch()} retrying={list.isFetching} />
        </div>
      </div>
    );
  }

  const { totalPages, currentPage, visibleRecipes } = paginateRecipes(recipes, pageIndex, PAGE_SIZE);
  const updateSearch = (value: string) => { setSearch(value); setPageIndex(1); };
  const updateCategory = (next: RecipeCategory) => { setCategory(next); setPageIndex(1); };
  const clearFilters = () => { setSearch(""); setCategory("all"); setPageIndex(1); };

  return (
    <div className="recipes-view">
      <RecipesHero totalText={recipeTotalText(data.length, profileView.hiddenCount, showAll)} search={search} onSearchChange={updateSearch} />
      <div className="recipes-content">
        <RecipeCategoryChips
          category={category}
          counts={counts}
          expanded={filtersExpanded}
          onToggle={() => setFiltersExpanded((value) => !value)}
          onChange={updateCategory}
        />
        <RecipesForYou
          recommendations={recommendations}
          recipesById={recipesById}
          featuredFit={featuredFit.data}
          isLoading={suggestions.isLoading}
          isError={suggestions.isError}
          isFetching={suggestions.isFetching}
          onRetry={() => void suggestions.refetch()}
        />
        <RecipeResults
          total={recipes.length}
          recipes={visibleRecipes}
          view={view}
          sort={sort}
          currentPage={currentPage}
          totalPages={totalPages}
          onViewChange={setView}
          onSortChange={(next) => { setSort(next); setPageIndex(1); }}
          onPageChange={(page) => setPageIndex(Math.min(totalPages, Math.max(1, page)))}
          onClearFilters={clearFilters}
          hiddenCount={profileView.hiddenCount}
          hiddenMatches={hiddenMatches}
          showAll={showAll}
          onShowAllChange={(next) => { setShowAll(next); setPageIndex(1); }}
        />
      </div>
    </div>
  );
}
