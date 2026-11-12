import { Search, X } from "lucide-react";
import { formatNumber } from "../../features/dashboard/dashboard.logic";
import { filterAttachableRecipes } from "../../features/community/community.logic";
import { recipeTotalMinutes } from "../../features/recipes/recipes.logic";
import type { Recipe } from "../../types";
import { IMAGE_WIDTHS } from "../../utils/images";
import { IconButton, RecipeImage } from "../ui";

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
  return (
    <div className="cm-picker" role="group" aria-label="Chọn công thức đính kèm">
      <div className="cm-picker__search">
        <Search className="cm-picker__icon" aria-hidden="true" />
        <input
          autoFocus
          className="ui-input cm-picker__input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm món hoặc nguyên liệu"
          aria-label="Tìm công thức theo tên hoặc nguyên liệu"
        />
        <IconButton label="Đóng chọn công thức" icon={<X />} quiet onClick={onClose} />
      </div>
      {isLoading && <p className="cm-picker__note">Đang tải công thức...</p>}
      {isError && <p className="cm-picker__note">Chưa tải được danh sách công thức.</p>}
      {recipes && !results.length && <p className="cm-picker__note">Không tìm thấy món phù hợp. Thử từ ngắn hơn hoặc tên nguyên liệu.</p>}
      {results.length > 0 && (
        <ul className="cm-picker__list">
          {results.map((recipe) => (
            <li key={recipe.id}>
              <button type="button" className="cm-picker__option" onClick={() => onSelect(recipe)}>
                <RecipeImage className="cm-picker__image" recipe={recipe} width={IMAGE_WIDTHS.thumb} alt="" />
                <span className="cm-picker__text">
                  <span className="cm-picker__name">{recipe.name}</span>
                  <span className="cm-picker__meta">
                    <span>{formatNumber(recipe.calories)} kcal</span>
                    <span>{recipeTotalMinutes(recipe)} phút</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
