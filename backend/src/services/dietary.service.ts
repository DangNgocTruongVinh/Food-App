import type { DietType } from "@prisma/client";

type DietaryRecipe = {
  name: string;
  dietTags: DietType[];
  ingredients: Array<{ name: string }>;
};

/** Không phân biệt hoa thường và khoảng trắng thừa; giữ nguyên dấu tiếng Việt ("cá" khác "cà"). */
export function normalizeFoodText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

// Nhóm dị ứng → các tên nguyên liệu thuộc nhóm. Người dùng nhập tên nhóm (hoặc tên gọi khác) thì loại cả nhóm.
// "Sữa" không loại "Sữa đậu nành"; "Bơ lạt" là sữa còn "Quả bơ" thì không.
const allergyGroups: Array<{ names: string[]; ingredients: string[] }> = [
  {
    names: ["hải sản", "thủy sản", "đồ biển", "seafood"],
    ingredients: ["tôm", "cua", "ghẹ", "mực", "bạch tuộc", "cá", "nghêu", "sò", "hến", "ốc", "nước mắm", "mắm"],
  },
  {
    names: ["sữa", "sản phẩm từ sữa", "lactose", "đạm sữa"],
    ingredients: ["sữa tươi", "sữa chua", "sữa đặc", "sữa bột", "phô mai", "bơ lạt", "kem tươi", "whey"],
  },
  { names: ["trứng"], ingredients: ["trứng"] },
  { names: ["đậu phộng", "lạc"], ingredients: ["đậu phộng", "lạc rang", "bơ đậu phộng"] },
  {
    names: ["gluten", "lúa mì", "bột mì"],
    ingredients: ["bột mì", "bánh mì", "mì ý", "mì trứng", "mì gói", "bột chiên giòn", "lúa mì"],
  },
];

/** Danh sách dị ứng/không thích của người dùng → các cụm từ cần tránh trong tên món và nguyên liệu. */
export function expandRestrictedTerms(items: string[]) {
  const terms = new Set<string>();
  for (const raw of items) {
    const item = normalizeFoodText(raw);
    if (!item) continue;
    const group = allergyGroups.find((entry) => entry.names.includes(item));
    if (group) group.ingredients.forEach((term) => terms.add(term));
    else terms.add(item);
  }
  return [...terms];
}

// So khớp theo nguyên từ: "ốc" không khớp "quốc", "cá" khớp "cá lóc" nhưng không khớp "cà chua".
const asWords = (value: string) => ` ${normalizeFoodText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/** Các cụm từ bị tránh xuất hiện trong tên món hoặc tên nguyên liệu. */
export function findRestrictedTerms(recipe: Pick<DietaryRecipe, "name" | "ingredients">, restrictedTerms: string[]) {
  const texts = [recipe.name, ...recipe.ingredients.map((ingredient) => ingredient.name)].map(asWords);
  return restrictedTerms.filter((term) => texts.some((text) => text.includes(asWords(term))));
}

// Nguyên liệu động vật trái với nhãn chay/thuần chay. Dùng chung cho kiểm tra dữ liệu seed và API Admin công thức.
export const MEAT_AND_FISH_TERMS = ["thịt", "sườn", "xương", "gà", "bò", "heo", "đùi gà", "ức gà", ...expandRestrictedTerms(["Hải sản"])];
export const ANIMAL_PRODUCT_TERMS = [...MEAT_AND_FISH_TERMS, ...expandRestrictedTerms(["Sữa", "Trứng"]), "mật ong"];

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
  const forbidden = dietTag === "VEGAN" ? ANIMAL_PRODUCT_TERMS : MEAT_AND_FISH_TERMS;
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
  const restricted = expandRestrictedTerms([...(profile?.allergies ?? []), ...(profile?.dislikedFoods ?? [])]);
  return recipes.filter((recipe) => matchesRequiredDiet(recipe, dietType) && !findRestrictedTerms(recipe, restricted).length);
}
