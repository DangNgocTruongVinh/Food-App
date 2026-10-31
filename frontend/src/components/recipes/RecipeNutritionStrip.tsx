import { formatNumber } from "../../features/dashboard/dashboard.logic";
import type { Recipe } from "../../types";

type NutritionRecipe = Pick<Recipe, "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG">;

/** Dinh dưỡng 1 khẩu phần (không đổi theo số khẩu phần đang chọn ở phần nguyên liệu). */
export default function RecipeNutritionStrip({ recipe }: { recipe: NutritionRecipe }) {
  const nutrition = [
    { label: "Năng lượng", value: `${formatNumber(recipe.calories)} kcal` },
    { label: "Đạm", value: `${formatNumber(recipe.proteinG)} g` },
    { label: "Tinh bột", value: `${formatNumber(recipe.carbsG)} g` },
    { label: "Chất béo", value: `${formatNumber(recipe.fatG)} g` },
    { label: "Chất xơ", value: `${formatNumber(recipe.fiberG)} g` },
  ];
  return (
    <section className="recipe-nutrition" aria-labelledby="recipe-nutrition-title">
      <h2 id="recipe-nutrition-title" className="ui-card-title">Dinh dưỡng mỗi khẩu phần</h2>
      <dl className="recipe-nutrition__list">
        {nutrition.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <p className="ui-small">Số liệu ước tính, tính cho 1 khẩu phần; không đổi khi bạn chỉnh số khẩu phần ở phần nguyên liệu.</p>
    </section>
  );
}
