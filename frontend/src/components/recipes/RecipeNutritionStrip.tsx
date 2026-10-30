import { Beef, Droplet, Flame, Leaf, Wheat } from "lucide-react";
import type { Recipe } from "../../types";

type NutritionRecipe = Pick<Recipe, "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG">;

export default function RecipeNutritionStrip({ recipe }: { recipe: NutritionRecipe }) {
  const nutrition = [
    { icon: Flame, label: "Năng lượng", value: `${recipe.calories} kcal` },
    { icon: Beef, label: "Protein", value: `${recipe.proteinG} g` },
    { icon: Wheat, label: "Tinh bột", value: `${recipe.carbsG} g` },
    { icon: Droplet, label: "Chất béo", value: `${recipe.fatG} g` },
    { icon: Leaf, label: "Chất xơ", value: `${recipe.fiberG} g` },
  ];
  return <section className="recipe-detail-nutrition" aria-label="Dinh dưỡng mỗi khẩu phần">
    {nutrition.map(({ icon: Icon, label, value }) => <article key={label}><Icon /><strong>{value}</strong><small>{label}</small></article>)}
  </section>;
}
