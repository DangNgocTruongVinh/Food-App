import { useQuery } from "@tanstack/react-query";
import { Beef, ChevronLeft, ChevronRight, Clock3, Flame, Grid2X2, Heart, Leaf, List, Search, SlidersHorizontal, Wheat } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, LoadingState } from "../components/States";
import {
  filterAndSortRecipes, paginateRecipes, recipeCategories, recipeDetailPath, recipeDietLabel, recipeImageSrc, recipeTotalMinutes,
  type RecipeCategory, type RecipeSort,
} from "../features/recipes/recipes.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";

export default function RecipesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState<RecipeCategory>("all");
  const [sort, setSort] = useState<RecipeSort>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [pageIndex, setPageIndex] = useState(1);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const { data = [], isLoading } = useQuery(recipeQueries.list());
  const recipes = useMemo(
    () => filterAndSortRecipes(data, { search, category, sort }),
    [category, data, search, sort],
  );
  if (isLoading) return <LoadingState />;
  const pageSize = 8;
  const { totalPages, currentPage, visibleRecipes } = paginateRecipes(recipes, pageIndex, pageSize);
  const updateCategory = (nextCategory: RecipeCategory) => { setCategory(nextCategory); setPageIndex(1); };
  const toggleFavorite = (id: string) => setFavorites((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <div className="page recipes-page">
    <header className="recipes-editorial-hero">
      <div><span className="eyebrow">Thư viện món ăn</span><h1>Công thức lành mạnh <Leaf /></h1><p>Khám phá món ngon, đầy đủ dinh dưỡng và phù hợp với mục tiêu sức khỏe của bạn.</p></div>
      <img src="/assets/nutrition-hero.jpg" alt="Món ăn lành mạnh với thịt gà và rau củ" />
    </header>

    <section className="recipes-discovery" aria-label="Tìm kiếm và lọc công thức">
      <div className="recipes-search-row"><label className="recipes-search-box"><Search /><input value={search} onChange={(event) => { setSearch(event.target.value); setPageIndex(1); }} placeholder="Tìm món ăn hoặc nguyên liệu..." /></label><button className="recipes-filter-toggle" onClick={() => setFiltersExpanded((current) => !current)} aria-expanded={filtersExpanded}><SlidersHorizontal /> Bộ lọc</button></div>
      <nav className={`recipes-category-pills${filtersExpanded ? "" : " collapsed"}`} aria-label="Danh mục công thức">{recipeCategories.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => updateCategory(item.id)} aria-pressed={category === item.id}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
    </section>

    <div className="recipes-results-toolbar"><strong>{recipes.length} công thức phù hợp</strong><div><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Hiển thị dạng lưới" aria-pressed={view === "grid"}><Grid2X2 /></button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="Hiển thị dạng danh sách" aria-pressed={view === "list"}><List /></button><label><select aria-label="Sắp xếp công thức" value={sort} onChange={(event) => { setSort(event.target.value as RecipeSort); setPageIndex(1); }}><option value="newest">Mới nhất</option><option value="quickest">Nhanh nhất</option><option value="calories">Ít calo</option><option value="protein">Nhiều protein</option></select></label></div></div>

    {visibleRecipes.length ? <div className={`recipe-grid recipes-result-grid ${view === "list" ? "list-view" : ""}`}>{visibleRecipes.map((recipe, index) => <article className={`recipe-card tone-${index % 4}`} key={recipe.id}><div className="recipe-visual"><Link className="recipe-visual-link" to={recipeDetailPath(recipe.id)} tabIndex={-1} aria-hidden="true"><img src={recipeImageSrc(recipe)} alt="" loading="lazy" /></Link><div className="recipe-tags"><b>{recipe.cuisine}</b>{recipe.dietTags.slice(0, 1).map((tag) => <b key={tag}>{recipeDietLabel(tag)}</b>)}</div><button className={`recipe-favorite${favorites.has(recipe.id) ? " active" : ""}`} onClick={() => toggleFavorite(recipe.id)} aria-label={favorites.has(recipe.id) ? `Bỏ ${recipe.name} khỏi yêu thích` : `Thêm ${recipe.name} vào yêu thích`} aria-pressed={favorites.has(recipe.id)}><Heart /></button></div><div className="recipe-body"><h3><Link to={recipeDetailPath(recipe.id)}>{recipe.name}</Link></h3><p>{recipe.description}</p><div className="recipe-meta"><span><Clock3 /> {recipeTotalMinutes(recipe)} phút</span><span><Flame /> {recipe.calories} kcal</span></div><div className="macro-row"><span><Beef /> {recipe.proteinG}g protein</span><span><Wheat /> {recipe.carbsG}g carb</span></div></div></article>)}</div> : <EmptyState title="Không tìm thấy công thức">Thử đổi từ khóa hoặc chọn một danh mục khác.</EmptyState>}

    {recipes.length > pageSize && <nav className="recipes-pagination" aria-label="Phân trang công thức"><button onClick={() => setPageIndex((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Trang trước"><ChevronLeft /></button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button key={page} className={currentPage === page ? "active" : ""} onClick={() => setPageIndex(page)} aria-current={currentPage === page ? "page" : undefined}>{page}</button>)}<button onClick={() => setPageIndex((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} aria-label="Trang sau"><ChevronRight /></button></nav>}
  </div>;
}
