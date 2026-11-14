import type { DietType } from "@prisma/client";
import {
  allergyCatalogVersion, allergyGroups, allergyMatchesOfFoodName, foldAllergyText, mainTermsOf, MAY_CONTAIN_PREFIX, normalizeAllergyText, resolveRestriction,
} from "./allergy-groups.js";

type DietaryRecipe = {
  name: string;
  dietTags: DietType[];
  ingredients: Array<{ name: string }>;
};

/** Không phân biệt hoa thường và khoảng trắng thừa; giữ nguyên dấu tiếng Việt ("cá" khác "cà"). */
export function normalizeFoodText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

// Nhóm dị ứng: danh mục dùng chung ở allergy-groups.ts (cùng bản với frontend). Ở đây chỉ còn phần lọc món nhanh (cache).

/**
 * Danh sách dị ứng/không thích của người dùng → các cụm từ cần tránh trong tên món và nguyên liệu.
 * strict (mặc định, dị ứng): tên nhóm, tên gọi khác hoặc một nguyên liệu của nhóm ("trứng gà", "trung ga", "egg", "dị ứng trứng")
 * → mọi nguyên liệu của nhóm. strict = false (món không thích): chỉ tên nhóm/tên gọi khác mới thành cả nhóm.
 * Mục không nhận ra vẫn được giữ làm cụm chữ (không bao giờ bỏ qua).
 */
export function expandRestrictedTerms(items: string[], { strict = true } = {}) {
  syncWithCatalog();
  const key = `${strict ? 1 : 0}\u0001${items.join("\u0001")}`;
  const cached = expandCache.get(key);
  if (cached) return cached;
  const terms = new Set<string>();
  for (const raw of items) {
    const resolved = resolveRestriction(raw, { strict });
    // Dị ứng: mọi nguyên liệu của nhóm, cả chế biến/gia vị và "có thể chứa" (an toàn trước). Món không thích (khẩu vị): chỉ nguyên
    // liệu chính ("cá" → cá lóc, cá hồi…; không nước mắm, dầu hào, nước tương).
    resolved.groups.forEach((group) => (strict ? [...group.terms, ...(group.mayContain ?? [])] : mainTermsOf(group))
      .forEach((term) => terms.add(normalizeAllergyText(term))));
    if (resolved.text) terms.add(resolved.text);
  }
  const result = [...terms];
  if (expandCache.size > 500) expandCache.clear(); // shortcut: cache đơn giản theo danh sách hồ sơ; đủ cho vài nghìn người dùng
  expandCache.set(key, result);
  return result;
}
const expandCache = new Map<string, string[]>();

// Cụm của danh mục → ngoại lệ của nhóm chứa nó ("sữa" không khớp "sữa đậu nành"). Cụm không có ở đây là chữ người dùng tự gõ.
// Dựng lại khi danh mục trong database được nạp lại (Admin sửa danh mục).
let CATALOG_EXCLUDES = new Map<string, string[]>();
let builtForVersion = -1;
function syncWithCatalog() {
  if (builtForVersion === allergyCatalogVersion()) return;
  const excludes = new Map<string, string[]>();
  for (const group of allergyGroups()) {
    for (const term of [...group.terms, ...(group.mayContain ?? [])]) {
      const key = normalizeAllergyText(term);
      excludes.set(key, [...(excludes.get(key) ?? []), ...(group.excludes ?? []).map(normalizeAllergyText)]);
    }
  }
  CATALOG_EXCLUDES = excludes;
  expandCache.clear();
  dietTermsCache = null;
  builtForVersion = allergyCatalogVersion();
}

type Needle = { term: string; folded: boolean; text: string; catalog: boolean; excludes: string[] };
const needleCache = new WeakMap<string[], Needle[]>();
const needlesOf = (terms: string[]) => {
  syncWithCatalog();
  const cached = needleCache.get(terms);
  if (cached) return cached;
  const needles = terms.map((term) => {
    const key = normalizeAllergyText(term);
    // Cụm của danh mục luôn so đúng dấu ("chao" ≠ "cháo"); chữ người dùng gõ không dấu thì so không dấu.
    const folded = !CATALOG_EXCLUDES.has(key) && key === foldAllergyText(term);
    return { term, folded, text: ` ${folded ? foldAllergyText(term) : key} `, catalog: CATALOG_EXCLUDES.has(key), excludes: CATALOG_EXCLUDES.get(key) ?? [] };
  });
  needleCache.set(terms, needles);
  return needles;
};

// Tên món + tên nguyên liệu đã chuẩn hóa (có dấu và không dấu), nhớ theo đối tượng món (bộ gợi ý kiểm nhiều lần trên cùng món).
type FoodText = { plain: string; folded: string };
const wordsCache = new WeakMap<object, FoodText[]>();
const foodText = (value: string): FoodText => ({ plain: ` ${normalizeAllergyText(value)} `, folded: ` ${foldAllergyText(value)} ` });
const recipeWords = (recipe: Pick<DietaryRecipe, "name" | "ingredients">) => {
  const cached = wordsCache.get(recipe);
  if (cached) return cached;
  const words = [recipe.name, ...recipe.ingredients.map((ingredient) => ingredient.name)].filter((name) => name.trim()).map(foodText);
  wordsCache.set(recipe, words);
  return words;
};

/**
 * Một cụm có khớp một tên (nguyên từ). Cụm của danh mục: một chiều + ngoại lệ của nhóm. Chữ người dùng tự gõ: hai chiều
 * ("thịt bò xay" ↔ nguyên liệu "Thịt bò"). Cụm không dấu thì so không dấu.
 */
function needleMatches(needle: Needle, text: FoodText) {
  const haystack = needle.folded ? text.folded : text.plain;
  if (needle.catalog) return haystack.includes(needle.text) && !needle.excludes.some((phrase) => text.plain.includes(` ${phrase} `));
  return haystack.includes(needle.text) || needle.text.includes(haystack);
}

/**
 * Hai danh sách cụm từ có chạm nhau theo nguyên từ, chiều nào cũng được ("cá" ↔ "cá hồi", "Hải sản" ↔ "hải sản").
 * Dùng cho câu gợi ý không gắn với món (vd. gợi ý dinh dưỡng của thực đơn, dòng hóa đơn) khi so với dị ứng/món không thích.
 */
export function overlapsFoodTerms(left: string[], right: string[]) {
  const a = left.map((item) => normalizeAllergyText(item)).filter(Boolean).map((item) => ` ${item} `);
  const b = right.map((item) => normalizeAllergyText(item)).filter(Boolean).map((item) => ` ${item} `);
  return a.some((x) => b.some((y) => x.includes(y) || y.includes(x)));
}

/** Các cụm từ bị tránh xuất hiện trong tên món hoặc tên nguyên liệu. */
export function findRestrictedTerms(recipe: Pick<DietaryRecipe, "name" | "ingredients">, restrictedTerms: string[]) {
  if (!restrictedTerms.length) return [];
  const texts = recipeWords(recipe);
  return needlesOf(restrictedTerms).filter((needle) => texts.some((text) => needleMatches(needle, text))).map(({ term }) => term);
}

/** Tên nguyên liệu (ưu tiên) hoặc tên món khớp các cụm bị tránh — cho nhãn "Có thành phần bạn không thích: Cá lóc". */
export function restrictedFoodNames(recipe: Pick<DietaryRecipe, "name" | "ingredients">, restrictedTerms: string[]) {
  if (!restrictedTerms.length) return [];
  const needles = needlesOf(restrictedTerms);
  const hit = (name: string) => needles.some((needle) => needleMatches(needle, foodText(name)));
  const ingredients = recipe.ingredients.map((ingredient) => ingredient.name).filter((name) => name.trim() && hit(name));
  return ingredients.length ? [...new Set(ingredients)] : hit(recipe.name) ? [recipe.name] : [];
}

/** Bỏ cụm từ đã nằm trong một cụm khác cũng khớp (vd. "mắm" khi đã có "nước mắm", "sữa" khi đã có "sữa tươi"). */
export const withoutNestedTerms = (terms: string[]) =>
  terms.filter((term) => !terms.some((other) => other !== term && ` ${other} `.includes(` ${term} `)));

/**
 * Nhãn "nhóm (nguyên liệu)" cho các dị ứng món vi phạm, vd. ["Trứng (Trứng)", "Gluten (Bánh mì)"]; mục không thuộc nhóm ghi
 * chính chữ đó. Chỉ gọi khi findRestrictedTerms đã thấy vi phạm (chậm hơn, dùng cho phần hiển thị "Chứa: …").
 */
export function allergenLabels(recipe: Pick<DietaryRecipe, "name" | "ingredients">, allergies: string[]) {
  const names = [...recipe.ingredients.map((ingredient) => ingredient.name), recipe.name].filter((name) => name.trim());
  const labels = new Map<string, Set<string>>();
  const add = (label: string, name: string) => labels.set(label, (labels.get(label) ?? new Set()).add(name));
  // Ưu tiên nêu nguyên liệu; chỉ nêu tên món khi không nguyên liệu nào khớp.
  const addHits = (label: string, hits: string[]) => {
    const ingredientHits = hits.filter((name) => name !== recipe.name);
    (ingredientHits.length ? ingredientHits : hits).forEach((name) => add(label, name));
  };
  for (const raw of allergies) {
    const resolved = resolveRestriction(raw);
    for (const group of resolved.groups) {
      const matches = names.map((name) => ({ name, match: allergyMatchesOfFoodName(name).find((item) => item.group === group) }));
      const certain = matches.filter(({ match }) => match?.certain).map(({ name }) => name);
      const maybe = matches.filter(({ match }) => match && !match.certain).map(({ name }) => name);
      addHits(group.label, certain);
      addHits(`${MAY_CONTAIN_PREFIX}${group.label}`, maybe.filter((name) => !certain.includes(name)));
    }
    if (resolved.text) {
      const [needle] = needlesOf([resolved.text]);
      addHits(resolved.text, names.filter((name) => needleMatches(needle, foodText(name))));
    }
  }
  return [...labels].map(([label, hits]) => `${label} (${[...hits].join(", ")})`);
}

// Nguyên liệu động vật trái với nhãn chay/thuần chay. Dùng chung cho kiểm tra dữ liệu seed và API Admin công thức.
// Dựng từ danh mục dị ứng (nạp từ database) nên tính khi cần, nhớ tới lần nạp lại danh mục kế tiếp.
let dietTermsCache: { meatAndFish: string[]; animalProduct: string[] } | null = null;
function dietTerms() {
  syncWithCatalog();
  if (!dietTermsCache) {
    const meatAndFish = ["thịt", "sườn", "xương", "gà", "bò", "heo", "đùi gà", "ức gà", ...expandRestrictedTerms(["Hải sản"])];
    dietTermsCache = { meatAndFish, animalProduct: [...meatAndFish, ...expandRestrictedTerms(["Sữa", "Trứng"]), "mật ong"] };
  }
  return dietTermsCache;
}

/** Nhãn chế độ ăn không trùng lặp; món thuần chay luôn được gắn thêm nhãn chay. */
export function normalizeDietTags(tags: DietType[]) {
  const unique = new Set(tags);
  if (unique.has("VEGAN")) unique.add("VEGETARIAN");
  return [...unique];
}

export type DietViolation = { ingredient: string; terms: string[]; dietTag: "VEGETARIAN" | "VEGAN" };

/**
 * Nguyên liệu trái với nhãn: VEGAN không được có thịt/cá/hải sản, sữa, trứng, mật ong; VEGETARIAN không được có
 * thịt/cá/hải sản (kể cả nước mắm). Chỉ xét tên nguyên liệu (món chay có thể tên "gà chay").
 */
export function findDietViolations(recipe: Pick<DietaryRecipe, "dietTags" | "ingredients">): DietViolation[] {
  const dietTag = recipe.dietTags.includes("VEGAN") ? "VEGAN" : recipe.dietTags.includes("VEGETARIAN") ? "VEGETARIAN" : null;
  if (!dietTag) return [];
  const forbidden = dietTag === "VEGAN" ? dietTerms().animalProduct : dietTerms().meatAndFish;
  return recipe.ingredients.flatMap(({ name }) => {
    const terms = findRestrictedTerms({ name: "", ingredients: [{ name }] }, forbidden);
    return terms.length ? [{ ingredient: name, terms, dietTag }] : [];
  });
}

/** Chay và thuần chay là ràng buộc bắt buộc; các chế độ khác chỉ dùng để ưu tiên. */
export function matchesRequiredDiet(recipe: Pick<DietaryRecipe, "dietTags">, dietType: DietType) {
  if (dietType === "VEGAN") return recipe.dietTags.includes("VEGAN");
  if (dietType === "VEGETARIAN") return recipe.dietTags.includes("VEGETARIAN") || recipe.dietTags.includes("VEGAN");
  return true;
}

export function prefersDiet(recipe: Pick<DietaryRecipe, "dietTags">, dietType: DietType) {
  return (dietType === "LOW_CARB" || dietType === "HIGH_PROTEIN") && recipe.dietTags.includes(dietType);
}

export function filterRecipesForProfile<T extends DietaryRecipe>(
  recipes: T[],
  profile: { dietType?: DietType | null; allergies?: string[]; dislikedFoods?: string[] } | null | undefined,
) {
  const dietType = profile?.dietType ?? "BALANCED";
  const restricted = [
    ...expandRestrictedTerms(profile?.allergies ?? []),
    ...expandRestrictedTerms(profile?.dislikedFoods ?? [], { strict: false }),
  ];
  return recipes.filter((recipe) => matchesRequiredDiet(recipe, dietType) && !findRestrictedTerms(recipe, restricted).length);
}
