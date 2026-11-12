/**
 * Tìm món dùng chung cho mọi ô tìm món (Công thức, "Thêm món" ở Thực đơn, chọn món khi đăng bài, Admin).
 * BẢN GỐC: backend/src/services/recipe-search.ts; frontend/src/features/recipes/recipe-search.ts là bản chép y nguyên
 * (test frontend so hai file, sửa ở đây rồi chép sang). Không import gì để hai phía dùng được.
 *
 * - Chuẩn hóa như normalizeFoodText (gọn khoảng trắng, chữ thường). Từ gõ không dấu thì so không dấu ("com tron" khớp
 *   "Cơm trộn"); từ gõ có dấu thì so có dấu ("bò" không khớp "bó xôi") — như normalizeFoodText giữ dấu ("cá" khác "cà").
 * - Tách từ: món khớp khi có đủ các từ, thứ tự bất kỳ, trong tên, nguyên liệu, ẩm thực, loại bữa, chế độ ăn.
 *   Từ ≥ 3 chữ khớp đầu từ (gõ dở "tro" → "trộn"); từ ngắn hơn phải đúng cả từ ("bò" không khớp "bột").
 * - Đồng nghĩa nhỏ (SYNONYMS): cụm trong câu tìm trùng một nhóm thì khớp bất kỳ cụm nào của nhóm.
 * - Xếp hạng: khớp hết trong tên trước, rồi khớp trong tên + nguyên liệu, rồi phần còn lại; cùng hạng giữ thứ tự cũ.
 */
export type SearchableRecipe = {
  name: string;
  cuisine?: string | null;
  mealTypes?: readonly string[];
  dietTags?: readonly string[];
  ingredients?: ReadonlyArray<{ name: string }>;
};

/** Như normalizeFoodText (gọn khoảng trắng, chữ thường), bỏ thêm dấu câu; giữ dấu tiếng Việt. */
export function normalizeSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi").normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** normalizeSearchText rồi bỏ dấu: "Cơm trộn Đậu" → "com tron dau". */
export function foldSearchText(value: string) {
  return normalizeSearchText(value).normalize("NFD").replace(/\p{M}+/gu, "").replace(/đ/g, "d").normalize("NFC");
}

// Viết có dấu; so khớp không dấu khi người dùng gõ không dấu.
const SYNONYMS = [
  ["hàn quốc", "hàn", "korea", "korean"],
  ["nhật bản", "nhật", "japan", "japanese"],
  ["trung quốc", "trung hoa", "china", "chinese"],
  ["việt nam", "việt", "vietnam", "vietnamese"],
  ["thái lan", "thái", "thailand"],
  ["ý", "italia", "italy", "italian"],
  ["chay", "thuần chay", "ăn chay", "vegetarian", "vegan"],
  ["bò", "thịt bò", "beef"],
  ["gà", "thịt gà", "ức gà", "chicken"],
  ["heo", "thịt heo", "thịt lợn", "pork"],
  ["đậu hũ", "đậu phụ", "tofu"],
  ["sáng", "bữa sáng", "ăn sáng", "breakfast"],
  ["trưa", "bữa trưa", "lunch"],
  ["tối", "bữa tối", "dinner"],
  ["bữa phụ", "ăn vặt", "snack"],
  ["ít tinh bột", "low carb"],
  ["giàu đạm", "nhiều đạm", "high protein"],
];
const MAX_PHRASE_WORDS = 3;

// Nhãn tiếng Việt của loại bữa / chế độ ăn để tìm được "bữa sáng", "chay", "giàu đạm".
const MEAL_WORDS: Record<string, string> = { BREAKFAST: "bữa sáng", LUNCH: "bữa trưa", DINNER: "bữa tối", SNACK: "bữa phụ" };
const DIET_WORDS: Record<string, string> = {
  BALANCED: "cân bằng", VEGETARIAN: "món chay", VEGAN: "thuần chay", LOW_CARB: "ít tinh bột", HIGH_PROTEIN: "giàu đạm",
};

/** Một vế của câu tìm: các cụm thay thế nhau (đồng nghĩa); `accented` = người dùng gõ có dấu nên so có dấu ("bò" khác "bó"). */
export type SearchClause = { phrases: string[]; accented: boolean };

/** Câu tìm → các vế; món phải khớp mọi vế. Ghép cụm đồng nghĩa dài nhất trước ("thịt bò" chứ không "thịt" + "bò"). */
export function parseSearchQuery(query: string): SearchClause[] {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  const clauses: SearchClause[] = [];
  const findGroup = (typed: string) => SYNONYMS.find((entry) => entry.some((phrase) => phrase === typed || foldSearchText(phrase) === typed));
  for (let index = 0; index < words.length;) {
    const typedOf = (size: number) => words.slice(index, index + size).join(" ");
    let size = Math.min(MAX_PHRASE_WORDS, words.length - index);
    let group = findGroup(typedOf(size));
    while (!group && size > 1) group = findGroup(typedOf(--size));
    const typed = typedOf(size);
    const accented = typed !== foldSearchText(typed);
    const phrases = group ?? [typed];
    clauses.push({ accented, phrases: accented ? phrases : phrases.map(foldSearchText) });
    index += size;
  }
  return clauses;
}

function phraseIn(text: string, phrase: string) {
  if (text.includes(` ${phrase} `)) return true;
  // Từ cuối ≥ 3 chữ: cho khớp đầu từ (đang gõ dở "tro" → "trộn"); từ ngắn phải đúng cả từ ("bo" không ra "bột").
  return phrase.split(" ").pop()!.length >= 3 && text.includes(` ${phrase}`);
}

type Haystack = { accented: string; folded: string };
const haystack = (parts: string[]): Haystack => {
  const accented = ` ${normalizeSearchText(parts.join(" "))} `;
  return { accented, folded: ` ${foldSearchText(accented)} ` };
};
const clauseIn = (text: Haystack, clause: SearchClause) =>
  clause.phrases.some((phrase) => phraseIn(clause.accented ? text.accented : text.folded, phrase));

/** Hạng của món: 0 = khớp hết trong tên, 1 = trong tên + nguyên liệu, 2 = cần cả ẩm thực/bữa/chế độ ăn; null = không khớp. */
export function recipeSearchRank(recipe: SearchableRecipe, clauses: SearchClause[]): number | null {
  if (!clauses.length) return 0;
  const ingredients = (recipe.ingredients ?? []).map((item) => item.name);
  const extra = [
    recipe.cuisine ?? "",
    ...(recipe.mealTypes ?? []).map((type) => MEAL_WORDS[type] ?? ""),
    ...(recipe.dietTags ?? []).map((tag) => DIET_WORDS[tag] ?? ""),
  ];
  const levels = [haystack([recipe.name]), haystack([recipe.name, ...ingredients]), haystack([recipe.name, ...ingredients, ...extra])];
  const rank = levels.findIndex((text) => clauses.every((clause) => clauseIn(text, clause)));
  return rank === -1 ? null : rank;
}

/** Lọc + xếp hạng; câu tìm trống trả nguyên danh sách. */
export function searchRecipes<T extends SearchableRecipe>(recipes: T[], query: string): T[] {
  const clauses = parseSearchQuery(query);
  if (!clauses.length) return recipes;
  return recipes
    .map((recipe, index) => ({ recipe, index, rank: recipeSearchRank(recipe, clauses) }))
    .filter((entry): entry is { recipe: T; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.recipe);
}
