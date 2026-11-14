import type { ActivityLevel, DietType, Gender, HealthGoal } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GeneratedPlan } from "../src/modules/ai/ai.service.js";
import { fallbackPlan, mealSlots, reconcileAIPlan } from "../src/modules/meal-plans/meal-plan-generator.js";
import { REPEAT_WINDOW_DAYS, scoredPlan } from "../src/modules/meal-plans/meal-plan-scorer.js";
import type { Interaction } from "../src/modules/recommendation/interactions.js";
import { fitsMealType, recipeFit, safeRecipes } from "../src/modules/recommendation/safety.js";
import { filterRecipesForProfile, normalizeFoodText } from "../src/services/dietary.service.js";
import { calculateNutritionTargets } from "../src/services/nutrition.service.js";
import { type ConsumptionPantryItem, planConsumption } from "../src/services/pantry-consumption.js";
import { seedRecipesAsRecords } from "../src/test/seed-recipes.js";
import { useSeedCatalog } from "../src/services/catalog/catalog-build.js";

// Mô phỏng không có database: nạp danh mục từ dữ liệu seed (cùng hàm dựng như khi chạy thật).
useSeedCatalog();

// Đánh giá bộ tạo thực đơn (GĐ3b-R8) trên DỮ LIỆU MÔ PHỎNG, chỉ trong bộ nhớ: không đọc/ghi cơ sở dữ liệu.
// Chạy: npm run eval:mealplan -w backend. Kết quả ghi vào docs/thuat-toan-goi-y.md (giữa hai dấu EVAL-MEALPLAN).
// So sánh: bộ tạo cũ (fallbackPlan: xếp theo số nguyên liệu có trong kho + quy tắc giảm lặp) và bộ tạo mới (scoredPlan:
// thuật toán 3 + 0,3·thuật toán 1, kho ảo, không lặp trong 3 ngày), cùng hồ sơ, kho, lịch sử. Thêm một dòng "OpenAI giả lập":
// 30% số bữa AI trả món bất kỳ (kể cả vi phạm, sai bữa) → qua reconcileAIPlan (hỏng quá nửa → bộ tạo mới), để kiểm bước an toàn.

const SEEDS = [0, 1, 2, 3, 4].map((offset) => 20261109 + offset);
const USERS = 100;
const DAY_MS = 86_400_000;
const START = new Date(Date.UTC(2026, 10, 2));

function rng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  return { next, int, pick };
}

const recipes = seedRecipesAsRecords();
const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
const ingredientPool = [...new Map(recipes.flatMap((recipe) => recipe.ingredients)
  .map((ingredient) => [normalizeFoodText(ingredient.name), ingredient])).values()];
const DIETS: DietType[] = ["BALANCED", "BALANCED", "VEGETARIAN", "VEGAN", "LOW_CARB", "HIGH_PROTEIN"];
const GOALS: HealthGoal[] = ["LOSE_WEIGHT", "MAINTAIN", "BUILD_MUSCLE"];
const ACTIVITY: ActivityLevel[] = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE"];
const ALLERGIES = ["Đậu phộng", "Sữa", "Trứng", "Gluten", "Hải sản"];
const DISLIKES = ["Hành tây", "Nấm"];
const CUISINES = ["Việt Nam", "Nhật Bản", "Hàn Quốc", "Ý", "Thái Lan"];

type SimCase = {
  profile: Parameters<typeof scoredPlan>[0]["profile"] & { dietType: DietType; allergies: string[]; dislikedFoods: string[] };
  mealsPerDay: number; dailyTarget: number; pantry: ConsumptionPantryItem[]; history: Interaction[];
};

function simulate(seed: number): SimCase[] {
  const random = rng(seed);
  return Array.from({ length: USERS }, (_, index) => {
    const mealsPerDay = random.next() < 0.3 ? 4 : 3;
    const profile = {
      dietType: random.pick(DIETS), allergies: random.next() < 0.2 ? [random.pick(ALLERGIES)] : [],
      dislikedFoods: random.next() < 0.1 ? [random.pick(DISLIKES)] : [], preferredCuisines: random.next() < 0.7 ? [random.pick(CUISINES)] : [],
      mealsPerDay, age: random.int(20, 55), gender: random.pick<Gender>(["MALE", "FEMALE"]), heightCm: random.int(150, 185),
      weightKg: random.int(45, 90), activityLevel: random.pick(ACTIVITY), goal: random.pick(GOALS),
    };
    const dailyTarget = calculateNutritionTargets(profile).calories;
    // Kho: 8 thực phẩm lấy từ nguyên liệu của bộ món, lượng 1–4 lần định lượng một món, hạn 0–10 ngày (20% không có hạn).
    const pantry = Array.from({ length: 8 }, (_, item) => {
      const ingredient = random.pick(ingredientPool);
      return {
        id: `p-${index}-${item}`, name: ingredient.name, unit: ingredient.unit, quantity: ingredient.quantity * random.int(1, 4),
        expiryDate: random.next() < 0.2 ? null : new Date(START.getTime() + random.int(0, 10) * DAY_MS), createdAt: START,
      };
    });
    // Lịch sử: 0–25 bữa đã ăn (món an toàn với hồ sơ) trong 4 tuần trước.
    const safe = safeRecipes(recipes, profile);
    const history: Interaction[] = Array.from({ length: random.int(0, 25) }, () => ({
      userId: `sim-${index}`, recipeId: random.pick(safe).id, kind: "EATEN" as const, count: 1, at: new Date(START.getTime() - random.int(1, 28) * DAY_MS),
    }));
    return { profile, mealsPerDay, dailyTarget, pantry, history };
  });
}

/** "OpenAI giả lập": 70% số bữa là món an toàn, đúng bữa; 30% món bất kỳ trong cả bộ món. */
function simulatedAI(sim: SimCase, random: ReturnType<typeof rng>): GeneratedPlan {
  const safe = safeRecipes(recipes, sim.profile);
  return {
    summary: "AI",
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex,
      meals: mealSlots(sim.mealsPerDay).map((mealType) => {
        const fitting = safe.filter((recipe) => fitsMealType(recipe, mealType));
        const recipe = random.next() < 0.3 || !fitting.length ? random.pick(recipes) : random.pick(fitting);
        return { mealType, recipeId: recipe.id, servings: 1, reason: "AI" };
      }),
    })),
  };
}

type Metrics = { calorieGap: number; within10: number; expiringUsed: number; expiringTouched: number; repeats: number; distinct: number; violations: number };

function measure(plan: GeneratedPlan, sim: SimCase): Metrics {
  const days = [...plan.days].sort((a, b) => a.dayIndex - b.dayIndex);
  const gaps = days.map((day) => Math.abs(day.meals.reduce((sum, meal) => sum + byId.get(meal.recipeId)!.calories * meal.servings, 0) - sim.dailyTarget) / sim.dailyTarget);
  // Đồ sắp hết hạn trong tuần thực đơn (hạn ngày 0–6): ăn theo thực đơn, trừ kho như "Đã ăn" (đồ đã quá hạn ở ngày đó không trừ).
  const expiring = sim.pantry.filter((item) => item.expiryDate && item.expiryDate.getTime() < START.getTime() + 7 * DAY_MS);
  let pantry = sim.pantry.map((item) => ({ ...item }));
  for (const day of days) {
    const now = new Date(START.getTime() + day.dayIndex * DAY_MS);
    for (const meal of day.meals) {
      const recipe = byId.get(meal.recipeId)!;
      const after = new Map(planConsumption(recipe.ingredients, meal.servings, recipe.servings, pantry, now)
        .flatMap((line) => line.deductions.map((deduction) => [deduction.pantryItemId, deduction.quantityAfter] as const)));
      pantry = pantry.map((item) => (after.has(item.id) ? { ...item, quantity: after.get(item.id)! } : item));
    }
  }
  const used = expiring.map((item) => 1 - pantry.find((left) => left.id === item.id)!.quantity / item.quantity);
  const meals = days.flatMap((day) => day.meals.map((meal) => ({ ...meal, dayIndex: day.dayIndex })));
  const repeats = meals.filter((meal, index) => meals.slice(0, index)
    .some((other) => other.recipeId === meal.recipeId && meal.dayIndex - other.dayIndex < REPEAT_WINDOW_DAYS)).length;
  const violations = meals.filter((meal) => {
    const recipe = byId.get(meal.recipeId)!;
    return Boolean(recipe.hiddenAt) || !recipeFit(recipe, sim.profile).safe || !fitsMealType(recipe, meal.mealType);
  }).length;
  return {
    calorieGap: mean(gaps),
    within10: gaps.filter((gap) => gap <= 0.1).length / gaps.length,
    expiringUsed: used.length ? mean(used) : NaN,
    expiringTouched: used.length ? used.filter((share) => share > 0).length / used.length : NaN,
    repeats,
    distinct: new Set(meals.map((meal) => meal.recipeId)).size,
    violations: violations / meals.length,
  };
}

const mean = (values: number[]) => {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.reduce((sum, value) => sum + value, 0) / Math.max(1, finite.length);
};
const fmt = (value: number, digits = 2) => value.toFixed(digits).replace(".", ",");
const pct = (value: number) => `${fmt(value * 100, 1)}%`;

/** Lệch calo ngày nhỏ nhất bộ món cho phép: chọn mỗi bữa một món đúng bữa (khác nhau trong ngày) chỉ theo calo, bỏ mọi tiêu chí khác. */
function calorieLowerBound(allowed: typeof recipes, sim: SimCase) {
  const pools = mealSlots(sim.mealsPerDay).map((mealType) => {
    const declared = allowed.filter((recipe) => recipe.mealTypes.includes(mealType));
    return declared.length ? declared : allowed;
  });
  let best = Infinity;
  const search = (slot: number, total: number, used: Set<string>) => {
    if (slot === pools.length) { best = Math.min(best, Math.abs(total - sim.dailyTarget) / sim.dailyTarget); return; }
    for (const recipe of pools[slot]) {
      if (used.has(recipe.id)) continue;
      used.add(recipe.id);
      search(slot + 1, total + recipe.calories, used);
      used.delete(recipe.id);
    }
  };
  search(0, 0, new Set());
  return best;
}
const lowerBound: number[] = [];
const simTargets: number[] = [];

const started = Date.now();
const methods = [
  "Bộ tạo cũ (fallbackPlan)", "Bộ tạo mới, không có khoảng calo (so sánh)", "Bộ tạo mới (scoredPlan) **(dùng)**", "OpenAI giả lập → reconcileAIPlan",
] as const;
const results = new Map<string, Metrics[]>(methods.map((name) => [name, []]));
const timing = new Map<string, number>(methods.map((name) => [name, 0]));
let aiFallbacks = 0;
let plans = 0;
for (const seed of SEEDS) {
  const aiRandom = rng(seed * 7);
  for (const sim of simulate(seed)) {
    const allowed = filterRecipesForProfile(recipes, sim.profile);
    const pantryNames = new Set(sim.pantry.map((item) => normalizeFoodText(item.name)));
    const newPlan = (calorieWindow?: null) => scoredPlan({
      recipes: allowed, catalog: recipes, profile: sim.profile, mealsPerDay: sim.mealsPerDay, pantry: sim.pantry, history: sim.history, startDate: START, calorieWindow,
    });
    const run = (name: (typeof methods)[number], build: () => GeneratedPlan) => {
      const begin = performance.now();
      const plan = build();
      timing.set(name, timing.get(name)! + performance.now() - begin);
      results.get(name)!.push(measure(plan, sim));
    };
    run(methods[0], () => fallbackPlan(allowed, pantryNames, sim.mealsPerDay, sim.profile.dietType));
    run(methods[1], () => newPlan(null));
    run(methods[2], () => newPlan());
    run(methods[3], () => {
      const reconciled = reconcileAIPlan(simulatedAI(sim, aiRandom), allowed, pantryNames, sim.mealsPerDay, sim.profile.dietType);
      if (reconciled.source === "fallback") aiFallbacks += 1;
      return reconciled.source === "fallback" ? newPlan() : reconciled.plan;
    });
    lowerBound.push(calorieLowerBound(allowed, sim));
    simTargets.push(sim.dailyTarget);
    plans += 1;
  }
}

const lines: string[] = [];
lines.push(`Sinh bằng \`npm run eval:mealplan -w backend\`: ${SEEDS.length} lần mô phỏng (seed ${SEEDS[0]}–${SEEDS.at(-1)}), mỗi lần ${USERS} người `
  + `(${plans} thực đơn 7 ngày cho mỗi phương pháp). Hồ sơ ngẫu nhiên (5 chế độ ăn, 20% có một dị ứng, 10% có món không thích, 30% ăn 4 bữa), `
  + `kho 8 thực phẩm (lượng 1–4 lần định lượng một món, hạn 0–10 ngày, 20% không có hạn), lịch sử 0–25 bữa đã ăn trong 4 tuần trước. `
  + `Dữ liệu **mô phỏng**, chỉ trong bộ nhớ. Số trong bảng là trung bình trên mọi thực đơn.`);
lines.push("");
lines.push("| Phương pháp | Lệch calo ngày | Ngày lệch ≤ 10% | Lượng đồ sắp hết hạn dùng trước hạn | Đồ sắp hết hạn được dùng | Bữa lặp trong 3 ngày / thực đơn | Số món khác nhau | Vi phạm an toàn | Thời gian / thực đơn |");
lines.push("|---|---|---|---|---|---|---|---|---|");
for (const name of methods) {
  const rows = results.get(name)!;
  const avg = (key: keyof Metrics) => mean(rows.map((row) => row[key]));
  lines.push(`| ${name} | ${pct(avg("calorieGap"))} | ${pct(avg("within10"))} | ${pct(avg("expiringUsed"))} | ${pct(avg("expiringTouched"))} | `
    + `${fmt(avg("repeats"))} | ${fmt(avg("distinct"), 1)} | ${pct(avg("violations"))} | ${fmt(timing.get(name)! / plans, 1)} ms |`);
}
lines.push("");
lines.push(`Giới hạn dưới của lệch calo ngày với bộ món hiện có (mỗi bữa chọn món chỉ theo calo, khẩu phần 1, bỏ mọi tiêu chí khác): `
  + `${pct(mean(lowerBound))}; mục tiêu calo trung bình của hồ sơ mô phỏng ${Math.round(mean(simTargets))} kcal/ngày.`);
lines.push("");
lines.push(`"OpenAI giả lập": ${aiFallbacks}/${plans} thực đơn hỏng quá nửa số bữa nên dùng cả thực đơn của bộ tạo mới; còn lại bữa vi phạm được thay. `
  + `Thời gian chạy: ${((Date.now() - started) / 1000).toFixed(1)} s.`);

const output = lines.join("\n");
console.log(output);
const docPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/thuat-toan-goi-y.md");
const doc = readFileSync(docPath, "utf8");
const START_MARK = "<!-- EVAL-MEALPLAN:START -->";
const END_MARK = "<!-- EVAL-MEALPLAN:END -->";
if (doc.includes(START_MARK) && doc.includes(END_MARK)) {
  writeFileSync(docPath, `${doc.slice(0, doc.indexOf(START_MARK) + START_MARK.length)}\n${output}\n${doc.slice(doc.indexOf(END_MARK))}`);
  console.log(`\nĐã ghi kết quả vào ${docPath}`);
} else {
  console.log(`\nChưa có dấu ${START_MARK} / ${END_MARK} trong ${docPath}: chỉ in ra màn hình.`);
}
