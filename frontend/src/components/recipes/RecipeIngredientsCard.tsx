import { formatIngredientAmount } from "../../features/recipes/recipes.logic";
import type { Ingredient } from "../../types";

export default function RecipeIngredientsCard({ ingredients }: { ingredients: Ingredient[] }) {
  return <section className="recipe-detail-card">
    <h2>Nguyên liệu</h2>
    {ingredients.length ? <ul className="recipe-detail-ingredients">
      {ingredients.map((ingredient) => <li key={ingredient.id}>
        <span>{ingredient.name}{ingredient.optional && <small> (tùy chọn)</small>}</span>
        <strong>{formatIngredientAmount(ingredient)}</strong>
      </li>)}
    </ul> : <p className="recipe-detail-empty">Công thức chưa có danh sách nguyên liệu.</p>}
  </section>;
}
