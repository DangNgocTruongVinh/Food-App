import type { DietType, MealType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { filterRecipesForProfile } from "../services/dietary.service.js";
import { fallbackPlan, reconcileAIPlan } from "../modules/meal-plans/meal-plan-generator.js";
import { pickSwapRecipe } from "../modules/meal-plans/meal-swap.js";
import { isRecipeSafe, recipeFit, safeRecipes } from "../modules/recommendation/safety.js";
import { buildCollaborativeModel } from "../modules/recommendation/collaborative.js";
import { type EngineData, type EngineRecipe, type RecommendationContext, runRecommendation } from "../modules/recommendation/hybrid.js";
import { sampleMembers } from "../../prisma/sample-accounts.js";
import { seedRecipesAsRecords } from "./seed-recipes.js";

// Bộ test an toàn chung (GĐ3b-R1, gộp lượt 9): mọi chỗ gợi ý món không được trả món vi phạm dị ứng, món không thích,
// chế độ chay/thuần chay hay món đã ẩn. Đối chiếu với "đáp án" viết tay theo tên nguyên liệu của bộ món seed (không gọi lại
// dietary.service), nên lỗi trong bảng nhóm dị ứng hoặc nhãn chế độ ăn cũng bị phát hiện. Các thuật toán gợi ý mới (R3–R9)
// thêm hàm của mình vào SUGGESTERS.

const day = 86_400_000;
const hiddenSlugs = ["ca-kho-to", "pho-bo"];
const recipes = seedRecipesAsRecords().map((recipe) => ({ ...recipe, hiddenAt: hiddenSlugs.includes(recipe.slug) ? new Date(0) : null }));
const visible = recipes.filter((recipe) => !recipe.hiddenAt);

// Đáp án theo tên nguyên liệu (chữ thường) của 90 nguyên liệu seed, rà bằng tay.
const startsWithAny = (prefixes: string[]) => (name: string) => prefixes.some((prefix) => name === prefix || name.startsWith(`${prefix} `));
const ALLERGY_ORACLE: Record<string, (name: string) => boolean> = {
  "Hải sản": startsWithAny(["cá", "tôm", "nước mắm"]),
  "Sữa": startsWithAny(["sữa tươi", "sữa chua", "sữa đặc", "phô mai"]),
  "Trứng": startsWithAny(["trứng"]),
  "Đậu phộng": startsWithAny(["đậu phộng"]),
  "Gluten": startsWithAny(["bánh mì", "mì ý"]),
};
const MEAT_OR_FISH = startsWithAny(["thịt", "sườn", "xương", "đùi gà", "ức gà", "cá", "tôm", "nước mắm"]);
const ANIMAL_PRODUCT = (name: string) => MEAT_OR_FISH(name) || startsWithAny(["trứng", "sữa tươi", "sữa chua", "sữa đặc", "phô mai", "mật ong"])(name);
const DISLIKE_ORACLE: Record<string, (name: string) => boolean> = {
  "Hành tây": startsWithAny(["hành tây"]),
  "Hải sản": ALLERGY_ORACLE["Hải sản"],
};

type Profile = { dietType: DietType; allergies: string[]; dislikedFoods: string[] };
type Recipe = (typeof recipes)[number];
const names = (recipe: Recipe) => recipe.ingredients.map((ingredient) => ingredient.name.toLocaleLowerCase("vi"));
function oracleViolations(recipe: Recipe, profile: Profile) {
  const found: string[] = [];
  for (const name of names(recipe)) {
    for (const group of profile.allergies) if (ALLERGY_ORACLE[group](name)) found.push(`dị ứng ${group}: ${name}`);
    for (const group of profile.dislikedFoods) if (DISLIKE_ORACLE[group](name)) found.push(`không thích ${group}: ${name}`);
    if (profile.dietType === "VEGETARIAN" && MEAT_OR_FISH(name)) found.push(`chay: ${name}`);
    if (profile.dietType === "VEGAN" && ANIMAL_PRODUCT(name)) found.push(`thuần chay: ${name}`);
  }
  return found;
}
const isUnsafe = (recipe: Recipe, profile: Profile, mealType?: MealType) =>
  Boolean(recipe.hiddenAt) || oracleViolations(recipe, profile).length > 0 || Boolean(mealType && recipe.mealTypes.length && !recipe.mealTypes.includes(mealType));

const dietTypes: DietType[] = ["BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"];
const allergySets = [[], ["Hải sản"], ["Sữa"], ["Trứng"], ["Đậu phộng"], ["Gluten"], ["Hải sản", "Trứng", "Sữa", "Đậu phộng", "Gluten"]];
const dislikeSets = [[], ["Hành tây"], ["Hải sản"]];
const profiles: Profile[] = dietTypes.flatMap((dietType) => allergySets.flatMap((allergies) => dislikeSets.map((dislikedFoods) => ({ dietType, allergies, dislikedFoods }))));
const mealTypes: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];
const now = new Date("2026-11-03T03:00:00.000Z");
const pantry = [
  { name: "Đậu hũ", quantity: 300, unit: "G" as const, expiryDate: new Date(now.getTime() + day) },
  { name: "Tôm", quantity: 200, unit: "G" as const, expiryDate: new Date(now.getTime() + day) },
  { name: "Trứng", quantity: 4, unit: "ITEM" as const, expiryDate: new Date(now.getTime() + 2 * day) },
  { name: "Gạo", quantity: 2, unit: "KG" as const, expiryDate: null },
];
const pantryNames = new Set(pantry.map((item) => item.name.toLocaleLowerCase("vi")));

// Bộ gợi ý (GĐ3b-R5): mô hình cộng tác từ tương tác của các tài khoản mẫu; người dùng có lịch sử ăn cả món vi phạm (lịch sử cũ
// trước khi đổi hồ sơ) để thuật toán 1, 2 có lý do đẩy món đó lên — lọc an toàn vẫn phải loại.
const interactions = sampleMembers().flatMap((member) => member.recipes.map((slug) => ({
  userId: `mau${member.index}`, recipeId: slug, kind: "EATEN" as const, at: now, count: 1,
})));
const model = buildCollaborativeModel([...interactions, ...["pho-bo", "ca-kho-to", "canh-chua-ca-loc"].map((slug) => ({
  userId: "nguoi-xem", recipeId: slug, kind: "EATEN" as const, at: now, count: 1,
}))], now);
const engineData = (profile: Profile): EngineData => ({
  userId: "nguoi-xem", recipes: visible as unknown as EngineRecipe[], now, profile, pantry, model,
  interactions: ["pho-bo", "ca-kho-to", "canh-chua-ca-loc"].map((slug) => ({ userId: "nguoi-xem", recipeId: slug, kind: "EATEN" as const, at: now, count: 1 })),
  today: { calories: 0, proteinG: 0, meals: 0 },
});
const recommend = (context: RecommendationContext, extra: { recipeId?: string; focus?: boolean; mealType?: MealType } = {}) => (profile: Profile) =>
  runRecommendation(engineData(profile), {
    context, limit: 12, recipeId: extra.recipeId, mealType: extra.mealType, focusItem: extra.focus ? pantry[1] : undefined,
  }).items.map((entry) => recipes.find((recipe) => recipe.id === entry.recipe.id)!);

// Mỗi chỗ gợi ý: nhận hồ sơ, trả danh sách món đã gợi ý (kể cả món trong thực đơn).
const SUGGESTERS: Record<string, (profile: Profile) => Recipe[]> = {
  "lọc an toàn (safety)": (profile) => safeRecipes(recipes, profile),
  "thực đơn dự phòng (fallbackPlan)": (profile) => {
    const plan = fallbackPlan(filterRecipesForProfile(visible, profile), pantryNames, 4, profile.dietType);
    return plan.days.flatMap((planDay) => planDay.meals.map((meal) => recipes.find((recipe) => recipe.id === meal.recipeId)!));
  },
  "thực đơn OpenAI đã kiểm tra (reconcileAIPlan)": (profile) => {
    // AI "trả" thực đơn chọn trên toàn bộ món (kể cả món vi phạm, món ẩn) → bữa vi phạm phải bị thay.
    const aiPlan = { ...fallbackPlan(recipes, pantryNames, 4, "BALANCED"), summary: "AI" };
    const { plan } = reconcileAIPlan(aiPlan, filterRecipesForProfile(visible, profile), pantryNames, 4, profile.dietType);
    return plan.days.flatMap((planDay) => planDay.meals.map((meal) => recipes.find((recipe) => recipe.id === meal.recipeId)!));
  },
  "đổi món trong thực đơn cũ (pickSwapRecipe), mọi bữa": (profile) => mealTypes.flatMap((mealType) => {
    // Bữa cũ là món vi phạm (tôm, cá...) và cả bộ món (kể cả món ẩn) được đưa vào để chọn.
    const current = recipes.find((recipe) => recipe.slug === "canh-chua-ca-loc")!;
    const picked = pickSwapRecipe(recipes, profile, { recipeId: current.id, calories: current.calories, mealType }, { sameDay: new Set(), planCounts: new Map() });
    return picked ? [picked] : [];
  }),
  "API gợi ý: today": recommend("today"),
  "API gợi ý: today, bữa sáng": recommend("today", { mealType: "BREAKFAST" }),
  "API gợi ý: for-you": recommend("for-you"),
  "API gợi ý: pantry": recommend("pantry"),
  "API gợi ý: pantry, món cho Tôm": recommend("pantry", { focus: true }),
  "API gợi ý: similar (Cá kho tộ đã ẩn / Canh chua cá lóc)": (profile) => [
    ...recommend("similar", { recipeId: "ca-kho-to" })(profile), ...recommend("similar", { recipeId: "canh-chua-ca-loc" })(profile),
  ],
  "API gợi ý: also-cooked (Bún xào chay / Gà xào sả ớt)": (profile) => [
    ...recommend("also-cooked", { recipeId: "bun-xao-chay" })(profile), ...recommend("also-cooked", { recipeId: "ga-xao-sa-ot" })(profile),
  ],
};

const label = (profile: Profile) => `${profile.dietType}, dị ứng [${profile.allergies.join(", ")}], không thích [${profile.dislikedFoods.join(", ")}]`;

// Ma trận lớn (105 hồ sơ × 33 món × 5 bữa): chạy chung với cả bộ test có thể quá 5 giây mặc định.
describe(`Dietary safety matrix: ${profiles.length} profiles × every suggestion source`, { timeout: 30_000 }, () => {
  it("the hand-written oracle covers the seed data (each allergy group and diet hits at least one recipe)", () => {
    for (const group of Object.keys(ALLERGY_ORACLE)) {
      expect(recipes.some((recipe) => oracleViolations(recipe, { dietType: "BALANCED", allergies: [group], dislikedFoods: [] }).length), group).toBe(true);
    }
    expect(recipes.some((recipe) => oracleViolations(recipe, { dietType: "VEGAN", allergies: [], dislikedFoods: [] }).length)).toBe(true);
  });

  it.each(Object.entries(SUGGESTERS))("%s never returns a recipe that violates the profile or is hidden", (_source, suggest) => {
    for (const profile of profiles) {
      for (const recipe of suggest(profile)) {
        expect(recipe.hiddenAt, `${label(profile)} → ${recipe.slug} đã ẩn`).toBeNull();
        expect(oracleViolations(recipe, profile), `${label(profile)} → ${recipe.slug}`).toEqual([]);
      }
    }
  });

  it("safety keeps exactly the recipes the oracle allows (no over-filtering), per meal type", () => {
    for (const profile of profiles) {
      for (const mealType of [undefined, ...mealTypes]) {
        const expected = recipes.filter((recipe) => !isUnsafe(recipe, profile, mealType)).map((recipe) => recipe.slug);
        expect(safeRecipes(recipes, profile, { mealType }).map((recipe) => recipe.slug), `${label(profile)} ${mealType ?? ""}`).toEqual(expected);
      }
    }
  });

  it("the recipe list's fit flags exactly the recipes the oracle marks (for hiding and labels in \"Tất cả công thức\")", () => {
    for (const profile of profiles) {
      for (const recipe of visible) {
        const fit = recipeFit(recipe, profile);
        expect(fit.safe, `${label(profile)} → ${recipe.slug}`).toBe(oracleViolations(recipe, profile).length === 0);
        if (profile.allergies.length && oracleViolations(recipe, { ...profile, dislikedFoods: [], dietType: "BALANCED" }).length) {
          expect(fit.allergens.length, `${label(profile)} → ${recipe.slug}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("a hidden recipe is never safe, even for a profile without restrictions", () => {
    const hidden = recipes.filter((recipe) => recipe.hiddenAt);
    expect(hidden).toHaveLength(hiddenSlugs.length);
    for (const recipe of hidden) expect(isRecipeSafe(recipe, null)).toBe(false);
  });
});
