import type { MealType, Recipe } from "../../types";

export const portionOptions = [0.5, 1, 1.5, 2, 3, 4] as const;

/** Công thức đang hiện, hợp bữa và không vi phạm hồ sơ hiện tại (API đã tính fit bằng backend). */
export function addableRecipes(recipes: Recipe[], mealType: MealType, search: string) {
  const query = search.trim().toLocaleLowerCase("vi");
  return recipes
    .filter((recipe) => recipe.fit?.safe !== false)
    .filter((recipe) => !recipe.mealTypes?.length || recipe.mealTypes.includes(mealType))
    .filter((recipe) => {
      if (!query) return true;
      const text = `${recipe.name} ${recipe.cuisine} ${recipe.ingredients.map((item) => item.name).join(" ")}`.toLocaleLowerCase("vi");
      return text.includes(query);
    });
}
