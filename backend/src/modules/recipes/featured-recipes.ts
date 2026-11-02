import type { MealType, Prisma } from "@prisma/client";

/**
 * Trường tóm tắt cho Landing (công khai): không có nguyên liệu, cách làm, dinh dưỡng chi tiết hay dữ liệu người dùng.
 * `imagePublicId` chỉ dùng để biết món có ảnh đã tải lên, không trả ra ngoài.
 */
export const featuredRecipeSelect = {
  id: true, slug: true, name: true, imageUrl: true, imagePublicId: true, calories: true,
  prepMinutes: true, cookMinutes: true, dietTags: true, mealTypes: true,
} satisfies Prisma.RecipeSelect;

type FeaturedRow = Prisma.RecipeGetPayload<{ select: typeof featuredRecipeSelect }>;
export type FeaturedRecipe = Omit<FeaturedRow, "imagePublicId">;

const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

/** Xen kẽ theo bữa chính của món (sáng, trưa, tối, phụ), trong mỗi bữa theo tên, để danh sách ngắn không toàn một kiểu món. */
function interleaveByMeal(rows: FeaturedRow[]) {
  const groups = MEAL_ORDER.map((meal) => rows
    .filter((row) => (MEAL_ORDER.find((type) => row.mealTypes.includes(type)) ?? "SNACK") === meal)
    .sort((a, b) => a.name.localeCompare(b.name, "vi")));
  const result: FeaturedRow[] = [];
  for (let index = 0; result.length < rows.length; index++) {
    for (const group of groups) if (group[index]) result.push(group[index]);
  }
  return result;
}

/** Món có ảnh đã tải lên (Cloudinary) đứng trước, sau đó tới món chưa có ảnh; bỏ `imagePublicId` khỏi kết quả. */
export function pickFeaturedRecipes(rows: FeaturedRow[], limit: number): FeaturedRecipe[] {
  const withPhoto = interleaveByMeal(rows.filter((row) => row.imagePublicId));
  const withoutPhoto = interleaveByMeal(rows.filter((row) => !row.imagePublicId));
  return [...withPhoto, ...withoutPhoto].slice(0, limit).map(({ imagePublicId: _imagePublicId, ...recipe }) => recipe);
}
