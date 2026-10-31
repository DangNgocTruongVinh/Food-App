import { Search, X } from "lucide-react";
import { filterAttachableRecipes } from "../../features/community/community.logic";
import { recipeImageSrc } from "../../features/recipes/recipes.logic";
import type { Recipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";

type RecipePickerProps = {
  recipes?: Recipe[];
  isLoading: boolean;
  isError: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
};

/** Ô chọn công thức có sẵn để gắn vào bài viết, tìm theo tên (không phân biệt dấu). */
export default function RecipePicker({ recipes, isLoading, isError, query, onQueryChange, onSelect, onClose }: RecipePickerProps) {
  const results = filterAttachableRecipes(recipes ?? [], query);
  return <div className="community-recipe-picker" role="group" aria-label="Chọn công thức đính kèm">
    <div className="community-recipe-search">
      <Search />
      <input
        autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Tìm công thức theo tên..." aria-label="Tìm công thức theo tên"
      />
      <button type="button" onClick={onClose} aria-label="Đóng chọn công thức"><X /></button>
    </div>
    {isLoading && <p className="community-recipe-picker-note">Đang tải công thức...</p>}
    {isError && <p className="community-recipe-picker-note">Chưa tải được danh sách công thức.</p>}
    {recipes && !results.length && <p className="community-recipe-picker-note">Không có công thức phù hợp.</p>}
    {results.length > 0 && <ul>
      {results.map((recipe) => <li key={recipe.id}>
        <button type="button" onClick={() => onSelect(recipe)}>
          <img src={recipeImageSrc(recipe, IMAGE_WIDTHS.thumb)} alt="" />
          <span><strong>{recipe.name}</strong><small>{recipe.calories} kcal · {recipe.prepMinutes + recipe.cookMinutes} phút</small></span>
        </button>
      </li>)}
    </ul>}
  </div>;
}
