import { seedRecipes } from "../../prisma/seed-data.js";

/** Bộ món seed thật ở dạng bản ghi như sau khi đã lưu DB (id = slug), dùng chung cho các test. */
export function seedRecipesAsRecords() {
  return seedRecipes.map((recipe) => ({
    ...recipe,
    id: recipe.slug,
    servings: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      id: `${recipe.slug}-${index}`, recipeId: recipe.slug, optional: false, ...ingredient,
    })),
  }));
}
