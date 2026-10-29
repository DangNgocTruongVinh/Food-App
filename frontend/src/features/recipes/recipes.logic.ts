import type { Ingredient, Recipe } from "../../types";
import { foodUnitLabel } from "../../utils/units";

export type RecipeCategory = "all" | "vietnamese" | "international" | "breakfast" | "healthy" | "low-carb" | "vegetarian";
export type RecipeSort = "newest" | "quickest" | "calories" | "protein";

export const recipeCategories: Array<{ id: RecipeCategory; label: string; icon: string }> = [
  { id: "all", label: "Tất cả", icon: "▦" },
  { id: "vietnamese", label: "Việt Nam", icon: "🍲" },
  { id: "international", label: "Quốc tế", icon: "🌍" },
  { id: "breakfast", label: "Ăn sáng", icon: "☀️" },
  { id: "healthy", label: "Healthy", icon: "🌿" },
  { id: "low-carb", label: "Low Carb", icon: "🥗" },
  { id: "vegetarian", label: "Món chay", icon: "🥬" },
];

export function recipeImage(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("yến mạch") || normalized.includes("sữa chua") || normalized.includes("chuối")) return "/assets/recipe-oats.jpg";
  if (normalized.includes("cá") || normalized.includes("tôm") || normalized.includes("ngừ")) return "/assets/recipe-salmon.jpg";
  if (normalized.includes("đậu") || normalized.includes("rau") || normalized.includes("nấm") || normalized.includes("bowl")) return "/assets/recipe-vegan-bowl.jpg";
  return "/assets/nutrition-hero.jpg";
}

export function matchesRecipeCategory(recipe: Recipe, category: RecipeCategory) {
  if (category === "all") return true;
  // cuisine thống nhất "Việt Nam"; mọi nền ẩm thực khác ("Ý", "Nhật Bản"...) là quốc tế.
  if (category === "vietnamese") return recipe.cuisine.toLowerCase().includes("việt");
  if (category === "international") return !recipe.cuisine.toLowerCase().includes("việt");
  if (category === "healthy") return recipe.dietTags.includes("BALANCED");
  if (category === "low-carb") return recipe.dietTags.includes("LOW_CARB");
  if (category === "vegetarian") return recipe.dietTags.some((tag) => tag === "VEGETARIAN" || tag === "VEGAN");
  if (recipe.mealTypes?.length) return recipe.mealTypes.includes("BREAKFAST");
  const copy = `${recipe.name} ${recipe.description}`.toLowerCase();
  return copy.includes("sáng") || copy.includes("yến mạch") || copy.includes("trứng") || copy.includes("sữa chua");
}

export function filterAndSortRecipes(
  data: Recipe[],
  options: { search: string; category: RecipeCategory; sort: RecipeSort },
) {
  const query = options.search.trim().toLowerCase();
  const filtered = data.filter((recipe) => {
    const searchCopy = `${recipe.name} ${recipe.cuisine} ${recipe.ingredients.map((ingredient) => ingredient.name).join(" ")}`.toLowerCase();
    return (!query || searchCopy.includes(query)) && matchesRecipeCategory(recipe, options.category);
  });

  return [...filtered].sort((a, b) => {
    if (options.sort === "quickest") return (a.prepMinutes + a.cookMinutes) - (b.prepMinutes + b.cookMinutes);
    if (options.sort === "calories") return a.calories - b.calories;
    if (options.sort === "protein") return b.proteinG - a.proteinG;
    return data.indexOf(a) - data.indexOf(b);
  });
}

export function paginateRecipes(recipes: Recipe[], pageIndex: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(recipes.length / pageSize));
  const currentPage = Math.min(pageIndex, totalPages);
  return {
    totalPages,
    currentPage,
    visibleRecipes: recipes.slice((currentPage - 1) * pageSize, currentPage * pageSize),
  };
}

// Ảnh do Admin upload (imageUrl) được ưu tiên; chưa có thì dùng ảnh minh họa local theo tên món.
export function recipeImageSrc(recipe: Pick<Recipe, "name" | "imageUrl">) {
  return recipe.imageUrl || recipeImage(recipe.name);
}

export function recipeDetailPath(id: string) {
  return `/recipes/${encodeURIComponent(id)}`;
}

export function recipeTotalMinutes(recipe: Pick<Recipe, "prepMinutes" | "cookMinutes">) {
  return recipe.prepMinutes + recipe.cookMinutes;
}

export function formatIngredientAmount(ingredient: Pick<Ingredient, "quantity" | "unit">) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(ingredient.quantity)} ${foodUnitLabel[ingredient.unit]}`;
}

export function recipeDietLabel(tag: string) {
  return tag.replaceAll("_", " ");
}
