import { Minus, Plus } from "lucide-react";
import { formatScaledIngredientAmount, MAX_RECIPE_SERVINGS } from "../../features/recipes/recipes.logic";
import type { Ingredient } from "../../types";
import { Button, Card, IconButton } from "../ui";

type RecipeIngredientsCardProps = {
  ingredients: Ingredient[];
  recipeServings: number;
  servings: number;
  onServingsChange: (servings: number) => void;
};

/** Định lượng nhân theo số khẩu phần đang chọn (chỉ hiển thị, không lưu). */
export default function RecipeIngredientsCard({ ingredients, recipeServings, servings, onServingsChange }: RecipeIngredientsCardProps) {
  const maxServings = Math.max(MAX_RECIPE_SERVINGS, recipeServings);
  return (
    <Card as="section" className="recipe-panel" aria-labelledby="recipe-ingredients-title">
      <header className="recipe-panel__header">
        <h2 id="recipe-ingredients-title" className="ui-section-title">Nguyên liệu</h2>
        <div className="recipe-stepper" role="group" aria-label="Số khẩu phần">
          <IconButton label="Giảm 1 khẩu phần" icon={<Minus />} disabled={servings <= 1} onClick={() => onServingsChange(servings - 1)} />
          <output className="recipe-stepper__value" aria-live="polite">{servings} khẩu phần</output>
          <IconButton label="Tăng 1 khẩu phần" icon={<Plus />} disabled={servings >= maxServings} onClick={() => onServingsChange(servings + 1)} />
        </div>
      </header>
      {servings !== recipeServings && (
        <p className="recipe-servings-hint">
          <span>Định lượng cho {servings} khẩu phần (công thức gốc: {recipeServings}).</span>
          <Button onClick={() => onServingsChange(recipeServings)}>Về như công thức</Button>
        </p>
      )}
      {ingredients.length ? (
        <ul className="recipe-ingredients">
          {ingredients.map((ingredient) => (
            <li key={ingredient.id}>
              <span>{ingredient.name}{ingredient.optional && <span className="recipe-ingredients__optional"> (tùy chọn)</span>}</span>
              <span className="recipe-ingredients__amount">{formatScaledIngredientAmount(ingredient, recipeServings, servings)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ui-text">Công thức chưa có danh sách nguyên liệu.</p>
      )}
    </Card>
  );
}
