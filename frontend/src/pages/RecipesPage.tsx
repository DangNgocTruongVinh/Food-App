import { useQuery } from "@tanstack/react-query";
import { Beef, Clock3, Flame, Search, Wheat } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { EmptyState, LoadingState } from "../components/States";
import type { Recipe } from "../types";

const recipeImage = (name: string) => {
  const normalized = name.toLowerCase();
  if (normalized.includes("yến mạch") || normalized.includes("sữa chua") || normalized.includes("chuối")) return "/assets/recipe-oats.jpg";
  if (normalized.includes("cá") || normalized.includes("tôm") || normalized.includes("ngừ")) return "/assets/recipe-salmon.jpg";
  if (normalized.includes("đậu") || normalized.includes("rau") || normalized.includes("nấm") || normalized.includes("bowl")) return "/assets/recipe-vegan-bowl.jpg";
  return "/assets/nutrition-hero.jpg";
};

export default function RecipesPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const { data = [], isLoading } = useQuery({ queryKey: ["recipes"], queryFn: async () => (await api.get<Recipe[]>("/recipes")).data });
  const recipes = useMemo(() => data.filter((recipe) => `${recipe.name} ${recipe.cuisine} ${recipe.ingredients.map((x) => x.name).join(" ")}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  if (isLoading) return <LoadingState />;
  return <div className="page"><header className="page-header"><div><span className="eyebrow">Thư viện món ăn</span><h1>Công thức lành mạnh</h1><p>Các món ăn có dữ liệu dinh dưỡng để AI xây thực đơn chính xác hơn.</p></div></header><div className="toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm món hoặc nguyên liệu..." /></label><span className="toolbar-count">{recipes.length} công thức</span></div>
    {recipes.length ? <div className="recipe-grid">{recipes.map((recipe, index) => <article className={`recipe-card tone-${index % 4}`} key={recipe.id}><div className="recipe-visual"><img src={recipeImage(recipe.name)} alt="" loading="lazy" /><div className="recipe-tags"><b>{recipe.cuisine}</b>{recipe.dietTags.slice(0, 1).map((tag) => <b key={tag}>{tag.replaceAll("_", " ")}</b>)}</div></div><div className="recipe-body"><h3>{recipe.name}</h3><p>{recipe.description}</p><div className="recipe-meta"><span><Clock3 /> {recipe.prepMinutes + recipe.cookMinutes} phút</span><span><Flame /> {recipe.calories} kcal</span></div><div className="macro-row"><span><Beef /> {recipe.proteinG}g protein</span><span><Wheat /> {recipe.carbsG}g carb</span></div></div></article>)}</div> : <EmptyState title="Không tìm thấy công thức">Thử tìm với một tên món hoặc nguyên liệu khác.</EmptyState>}
  </div>;
}
