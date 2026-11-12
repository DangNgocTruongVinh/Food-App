import type { FoodUnit, Ingredient, Recipe } from "../../types";
import { IMAGE_WIDTHS, isUploadedImageUrl, optimizedImageUrl } from "../../utils/images";
import { foodUnitLabel } from "../../utils/units";
import { searchRecipes } from "./recipe-search";

export type RecipeCategory = "all" | "vietnamese" | "international" | "breakfast" | "healthy" | "low-carb" | "vegetarian";
export type RecipeSort = "newest" | "quickest" | "calories" | "protein";

/** Danh mục lọc (nhãn tiếng Việt, không emoji — DESIGN.md mục 3, 9). "healthy" = món có nhãn Cân bằng. */
export const recipeCategories: Array<{ id: RecipeCategory; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "vietnamese", label: "Việt Nam" },
  { id: "international", label: "Quốc tế" },
  { id: "breakfast", label: "Ăn sáng" },
  { id: "healthy", label: "Cân bằng" },
  { id: "low-carb", label: "Ít tinh bột" },
  { id: "vegetarian", label: "Món chay" },
];

/** Số món thật của từng danh mục (trên danh sách đã tải, chưa áp ô tìm kiếm). */
export function recipeCategoryCounts(recipes: Recipe[]) {
  return Object.fromEntries(recipeCategories.map(({ id }) => [id, recipes.filter((recipe) => matchesRecipeCategory(recipe, id)).length])) as Record<RecipeCategory, number>;
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

/** Tìm (searchRecipes dùng chung: bỏ dấu, đủ từ, đồng nghĩa) + danh mục + sắp xếp. "Mới nhất" khi có từ khóa giữ thứ tự liên quan. */
export function filterAndSortRecipes(
  data: Recipe[],
  options: { search: string; category: RecipeCategory; sort: RecipeSort },
) {
  const searched = searchRecipes(data, options.search);
  const filtered = searched.filter((recipe) => matchesRecipeCategory(recipe, options.category));

  return [...filtered].sort((a, b) => {
    if (options.sort === "quickest") return (a.prepMinutes + a.cookMinutes) - (b.prepMinutes + b.cookMinutes);
    if (options.sort === "calories") return a.calories - b.calories;
    if (options.sort === "protein") return b.proteinG - a.proteinG;
    return searched.indexOf(a) - searched.indexOf(b);
  });
}

/**
 * "Tất cả công thức" ẩn mặc định món vi phạm dị ứng hoặc chế độ chay/thuần chay của người dùng (GĐ3b-R2).
 * Món không thích không bị ẩn, chỉ gắn nhãn (quyết định GĐ3b-R #2). Danh sách chưa có `fit` thì không ẩn gì.
 */
export function violatesProfile(recipe: Pick<Recipe, "fit">) {
  return Boolean(recipe.fit && (recipe.fit.allergens.length || recipe.fit.dietConflict));
}

export function recipesForProfile<T extends Pick<Recipe, "fit">>(recipes: T[], showAll: boolean) {
  const hiddenCount = recipes.filter(violatesProfile).length;
  return { hiddenCount, recipes: showAll ? recipes : recipes.filter((recipe) => !violatesProfile(recipe)) };
}

/**
 * Số liệu đầu trang và khi không có kết quả: danh sách hiển thị sau khi ẩn theo hồ sơ, số món khớp từ khóa nhưng đang bị ẩn
 * (dị ứng/chế độ ăn), số trên các ô lọc tính trên kết quả tìm.
 */
export function recipeSearchView<T extends Recipe>(data: T[], search: string, showAll: boolean) {
  const profileView = recipesForProfile(data, showAll);
  const matchedAll = searchRecipes(data, search);
  return {
    profileView,
    counts: recipeCategoryCounts(searchRecipes(profileView.recipes, search)),
    hiddenMatches: showAll ? 0 : matchedAll.filter(violatesProfile).length,
  };
}

/** Dòng đầu trang Công thức: "33 công thức" hoặc "30 món hợp với bạn (3 món ẩn theo hồ sơ)". */
export function recipeTotalText(total: number, hiddenCount: number, showAll: boolean) {
  return hiddenCount > 0 && !showAll ? `${total - hiddenCount} món hợp với bạn (${hiddenCount} món ẩn theo hồ sơ)` : `${total} công thức`;
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

/**
 * Ảnh món: chỉ ảnh Admin đã tải lên Cloudinary (tối ưu theo chiều rộng hiển thị). Chưa có thì trả null để hiện ô
 * --surface-2 kèm tên món (DESIGN.md mục 10) — không dùng ảnh nhóm /assets/... vì dễ sai món.
 */
export function recipePhotoSrc(recipe: Pick<Recipe, "imageUrl">, width: number = IMAGE_WIDTHS.card) {
  return isUploadedImageUrl(recipe.imageUrl) ? optimizedImageUrl(recipe.imageUrl, width) : null;
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

export const MAX_RECIPE_SERVINGS = 12;

/** Số khẩu phần người dùng chọn: 1 → 12 (hoặc số khẩu phần gốc nếu công thức lớn hơn 12). Chỉ hiển thị, không lưu. */
export function clampServings(value: number, recipeServings: number) {
  const max = Math.max(MAX_RECIPE_SERVINGS, recipeServings);
  return Math.min(max, Math.max(1, Math.round(value)));
}

/** Làm tròn định lượng theo đơn vị: g/ml số nguyên (dưới 1 giữ 0,1 để không thành 0), kg/lít 0,01, cái/gói bội số 0,5. */
export function roundIngredientQuantity(quantity: number, unit: FoodUnit) {
  if (quantity <= 0) return 0;
  if (unit === "G" || unit === "ML") return quantity >= 1 ? Math.round(quantity) : Math.max(0.1, Math.round(quantity * 10) / 10);
  if (unit === "ITEM" || unit === "PACKAGE") return Math.max(0.5, Math.round(quantity * 2) / 2);
  return Math.max(0.01, Math.round(quantity * 100) / 100);
}

/** Định lượng nhân theo tỷ lệ khẩu phần; giữ nguyên số gốc khi không đổi khẩu phần. */
export function scaleIngredientQuantity(ingredient: Pick<Ingredient, "quantity" | "unit">, recipeServings: number, servings: number) {
  if (servings === recipeServings) return ingredient.quantity;
  return roundIngredientQuantity((ingredient.quantity * servings) / Math.max(1, recipeServings), ingredient.unit);
}

export function formatScaledIngredientAmount(ingredient: Pick<Ingredient, "quantity" | "unit">, recipeServings: number, servings: number) {
  return formatIngredientAmount({ unit: ingredient.unit, quantity: scaleIngredientQuantity(ingredient, recipeServings, servings) });
}

/** Nhãn chế độ ăn của món bằng tiếng Việt (DESIGN.md mục 9: không trộn tiếng Anh như "Low Carb"). */
export const RECIPE_DIET_LABELS: Record<string, string> = {
  BALANCED: "Cân bằng",
  VEGETARIAN: "Món chay",
  VEGAN: "Thuần chay",
  LOW_CARB: "Ít tinh bột",
  HIGH_PROTEIN: "Giàu đạm",
};

export function recipeDietLabel(tag: string) {
  return RECIPE_DIET_LABELS[tag] ?? tag.replaceAll("_", " ");
}
