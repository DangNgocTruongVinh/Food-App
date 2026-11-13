import { prisma } from "../../lib/prisma.js";
import { groupsOfFoodName } from "../../services/allergy-groups.js";
import { foldSearchText } from "../../services/recipe-search.js";
import { visibleRecipeWhere } from "../../services/recipe-visibility.js";

export const FOOD_SUGGESTION_LIMIT = 8;

/**
 * Gợi ý tên thực phẩm cho ô nhập ở Kho: tên trong kho của CHÍNH người dùng (userId từ JWT) trước, rồi nguyên liệu của các
 * món đang hiện (dữ liệu công khai trong ứng dụng). Mỗi mục kèm nhóm dị ứng (cùng danh mục với bộ lọc).
 * Khớp không dấu, mọi từ của câu tìm khớp đầu một từ của tên; tên bắt đầu bằng câu tìm lên trước.
 */
export async function suggestFoodNames(userId: string, query: string) {
  const words = foldSearchText(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  const [pantry, ingredients] = await Promise.all([
    prisma.pantryItem.findMany({ where: { userId }, select: { name: true }, distinct: ["name"], take: 500 }),
    prisma.recipeIngredient.findMany({ where: { recipe: visibleRecipeWhere }, select: { name: true }, distinct: ["name"] }),
  ]);
  const seen = new Set<string>();
  const candidates = [
    ...pantry.map(({ name }) => ({ name, source: "PANTRY" as const })),
    ...ingredients.map(({ name }) => ({ name, source: "RECIPE" as const })),
  ].filter(({ name }) => {
    const key = foldSearchText(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const folded = foldSearchText(query);
  return candidates
    .map((candidate, index) => {
      const nameWords = foldSearchText(candidate.name).split(" ");
      const matches = words.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)));
      return { candidate, index, rank: !matches ? null : foldSearchText(candidate.name).startsWith(folded) ? 0 : 1 };
    })
    .filter((entry) => entry.rank !== null)
    .sort((a, b) => a.rank! - b.rank! || a.index - b.index)
    .slice(0, FOOD_SUGGESTION_LIMIT)
    .map(({ candidate }) => ({ ...candidate, allergyGroups: groupsOfFoodName(candidate.name).map((group) => group.label) }));
}
