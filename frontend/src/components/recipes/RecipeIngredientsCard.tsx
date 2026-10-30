import { Minus, Plus } from "lucide-react";
import { formatScaledIngredientAmount, MAX_RECIPE_SERVINGS } from "../../features/recipes/recipes.logic";
import type { Ingredient } from "../../types";

type RecipeIngredientsCardProps = {
  ingredients: Ingredient[];
  recipeServings: number;
  servings: number;
  onServingsChange: (servings: number) => void;
};

/** Định lượng nhân theo số khẩu phần đang chọn (chỉ hiển thị, không lưu). */
export default function RecipeIngredientsCard({ ingredients, recipeServings, servings, onServingsChange }: RecipeIngredientsCardProps) {
  const maxServings = Math.max(MAX_RECIPE_SERVINGS, recipeServings);
  return <section className="recipe-detail-card">
    <div className="recipe-ingredients-head">
      <h2>Nguyên liệu</h2>
      <div className="recipe-servings-stepper" role="group" aria-label="Số khẩu phần">
        <button type="button" aria-label="Giảm 1 khẩu phần" disabled={servings <= 1} onClick={() => onServingsChange(servings - 1)}><Minus /></button>
        <output aria-live="polite">{servings} khẩu phần</output>
        <button type="button" aria-label="Tăng 1 khẩu phần" disabled={servings >= maxServings} onClick={() => onServingsChange(servings + 1)}>
          <Plus />
        </button>
      </div>
    </div>
    {servings !== recipeServings && <p className="recipe-servings-note">
      Định lượng cho {servings} khẩu phần (công thức gốc: {recipeServings}).{" "}
      <button type="button" onClick={() => onServingsChange(recipeServings)}>Về như công thức</button>
    </p>}
    {ingredients.length ? <ul className="recipe-detail-ingredients">
      {ingredients.map((ingredient) => <li key={ingredient.id}>
        <span>{ingredient.name}{ingredient.optional && <small> (tùy chọn)</small>}</span>
        <strong>{formatScaledIngredientAmount(ingredient, recipeServings, servings)}</strong>
      </li>)}
    </ul> : <p className="recipe-detail-empty">Công thức chưa có danh sách nguyên liệu.</p>}
  </section>;
}
