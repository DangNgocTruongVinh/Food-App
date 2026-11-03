import type { DietType, Gender, HealthGoal } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCollaborativeModel, type CollaborativeModel } from "../src/modules/recommendation/collaborative.js";
import { getFeatureSpace, similarity } from "../src/modules/recommendation/features.js";
import { type EngineData, type EngineProfile, type EngineRecipe, runRecommendation } from "../src/modules/recommendation/hybrid.js";
import type { Interaction, InteractionKind } from "../src/modules/recommendation/interactions.js";
import { expiringFeature, mealTarget } from "../src/modules/recommendation/knowledge-based.js";
import type { Algorithm } from "../src/modules/recommendation/reasons.js";
import { recipeFit, safeRecipes } from "../src/modules/recommendation/safety.js";
import { normalizeFoodText } from "../src/services/dietary.service.js";
import type { FitPantryItem } from "../src/services/recipe-fit.service.js";
import { seedRecipesAsRecords } from "../src/test/seed-recipes.js";

// Đánh giá các thuật toán gợi ý (GĐ3b-R6) trên DỮ LIỆU MÔ PHỎNG, chỉ trong bộ nhớ: không đọc/ghi cơ sở dữ liệu, không tạo tài khoản.
// Chạy: npm run eval:recommend -w backend. Kết quả ghi vào docs/thuat-toan-goi-y.md (giữa hai dấu EVAL).
//
// Mô phỏng: 80 người, 6 nhóm khẩu vị, hồ sơ (kể cả dị ứng/không thích), kho, 4 tuần tương tác. Độ ưa thích của người u với món r:
//   a_u(r) = (luật của nhóm theo đặc trưng món) + 2,0·[r là "món ruột" của nhóm] + nhiễu N(0; 0,6) riêng từng người
// "Món ruột" (3 món ngẫu nhiên mỗi nhóm) không suy ra được từ đặc trưng món — nếu không có, dữ liệu sinh từ đặc trưng sẽ thiên vị
// thuật toán 1. Mỗi tương tác chọn món theo softmax(a_u/T), T = 0,7, trong các món an toàn với hồ sơ của người đó.

const SEED = 20261103;
/** 5 lần mô phỏng với seed khác nhau, lấy trung bình (một lần mô phỏng nhiễu lớn với bộ món nhỏ). */
const SEEDS = [0, 1, 2, 3, 4].map((offset) => SEED + offset);
const USERS = 80;
const DAYS = 28;
const DAY_MS = 86_400_000;
const START = Date.UTC(2026, 9, 1);
const TEMPERATURE = 0.7;
const KS = [5, 10] as const;

// ---------- Số ngẫu nhiên có seed (mulberry32) ----------
function rng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const shuffle = <T>(items: T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  return { next, normal, pick, shuffle };
}

// ---------- Bộ món và nhóm khẩu vị ----------
const recipes = seedRecipesAsRecords() as unknown as EngineRecipe[];
const space = getFeatureSpace(recipes);
const names = (recipe: EngineRecipe) => recipe.ingredients.map((ingredient) => normalizeFoodText(ingredient.name));
const hasAny = (recipe: EngineRecipe, prefixes: string[]) => names(recipe).some((name) => prefixes.some((prefix) => name === prefix || name.startsWith(`${prefix} `)));

type Group = {
  name: string;
  dietType: DietType;
  goal: HealthGoal;
  cuisines: string[];
  affinity: (recipe: EngineRecipe) => number;
};
const GROUPS: Group[] = [
  { name: "Ăn chay", dietType: "VEGETARIAN", goal: "MAINTAIN", cuisines: ["Việt Nam"],
    affinity: (r) => (hasAny(r, ["đậu hũ", "nấm rơm", "nấm đông cô", "nấm bào ngư"]) ? 0.8 : 0) + (r.dietTags.includes("VEGAN") ? 0.4 : 0) },
  { name: "Mê hải sản", dietType: "BALANCED", goal: "MAINTAIN", cuisines: ["Việt Nam"],
    affinity: (r) => (hasAny(r, ["cá", "tôm"]) ? 1.8 : 0) + (r.cuisine === "Việt Nam" ? 0.3 : 0) },
  { name: "Ít tinh bột", dietType: "LOW_CARB", goal: "LOSE_WEIGHT", cuisines: [],
    affinity: (r) => (r.dietTags.includes("LOW_CARB") ? 1.5 : 0) - r.carbsG / 100 },
  { name: "Món Việt truyền thống", dietType: "BALANCED", goal: "MAINTAIN", cuisines: ["Việt Nam"],
    affinity: (r) => (r.cuisine === "Việt Nam" ? 1.2 : -0.5) + (r.mealTypes.includes("BREAKFAST") ? 0.3 : 0) },
  { name: "Món quốc tế", dietType: "BALANCED", goal: "MAINTAIN", cuisines: ["Ý", "Nhật Bản", "Hàn Quốc", "Thái Lan", "Hy Lạp", "Mỹ"],
    affinity: (r) => (r.cuisine !== "Việt Nam" ? 1.8 : 0) },
  { name: "Tập gym, giàu đạm", dietType: "HIGH_PROTEIN", goal: "BUILD_MUSCLE", cuisines: ["Việt Nam", "Nhật Bản"],
    affinity: (r) => (r.dietTags.includes("HIGH_PROTEIN") ? 1.2 : 0) + r.proteinG / 30 },
];
const ALLERGIES = ["Đậu phộng", "Sữa", "Trứng", "Gluten", "Hải sản"];
const DISLIKES = ["Hành tây", "Nấm"];

type SimUser = {
  id: string; index: number; group: Group; profile: EngineProfile; safe: EngineRecipe[];
  /** Kho: tên + số ngày còn hạn tính từ thời điểm gợi ý (để luôn có đồ sắp hết hạn, ở cả tập kiểm định và kiểm tra). */
  pantry: Array<{ name: string; daysLeft: number }>;
  events: Interaction[]; train: Interaction[]; test: Interaction[]; trainInner: Interaction[]; validation: Interaction[];
};

const allIngredients = [...new Set(recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)))];
const kinds: Array<[InteractionKind, number]> = [["EATEN", 0.8], ["LIKED", 0.15], ["POSTED", 0.05]];
const splitLast = (events: Interaction[], share = 0.2) => {
  const count = events.length ? Math.max(1, Math.round(events.length * share)) : 0;
  return { before: events.slice(0, events.length - count), after: events.slice(events.length - count) };
};

/** Một lần mô phỏng (người dùng, kho, tương tác) với seed cho trước. */
function simulate(seed: number): SimUser[] {
  const random = rng(seed);
  // "Món ruột": 3 món ngẫu nhiên an toàn với hồ sơ chung của nhóm.
  const favorites = new Map(GROUPS.map((group) => [group, random.shuffle(safeRecipes(recipes, { dietType: group.dietType, allergies: [], dislikedFoods: [] }))
    .slice(0, 3).map((recipe) => recipe.id)]));
  const pickKind = () => {
    let roll = random.next();
    for (const [kind, share] of kinds) { if ((roll -= share) < 0) return kind; }
    return "EATEN" as const;
  };
  /** Số tương tác: 10% chỉ 1 (tập huấn luyện trống), 20% ít (2–7), 70% nhiều (10–40) — để có đủ ba nhóm khởi đầu lạnh. */
  const activity = () => {
    const roll = random.next();
    if (roll < 0.1) return 1;
    if (roll < 0.3) return 2 + Math.floor(random.next() * 6);
    return 10 + Math.floor(random.next() * 31);
  };

  const users: SimUser[] = Array.from({ length: USERS }, (_, index) => {
    const group = GROUPS[index % GROUPS.length];
    const allergies = random.next() < 0.2 ? [random.pick(ALLERGIES.filter((a) => !(group.name === "Mê hải sản" && a === "Hải sản")))] : [];
    const dislikedFoods = random.next() < 0.1 ? [random.pick(DISLIKES)] : [];
    const profile: EngineProfile = {
      dietType: group.dietType, allergies, dislikedFoods, preferredCuisines: group.cuisines, mealsPerDay: 3,
      age: 20 + Math.floor(random.next() * 30), gender: random.pick<Gender>(["MALE", "FEMALE"]), heightCm: 155 + Math.floor(random.next() * 30),
      weightKg: 50 + Math.floor(random.next() * 35), activityLevel: "MODERATE", goal: group.goal,
    };
    const safe = safeRecipes(recipes, profile);
    const noise = new Map(safe.map((recipe) => [recipe.id, 0.6 * random.normal()]));
    const score = (recipe: EngineRecipe) => group.affinity(recipe) + (favorites.get(group)!.includes(recipe.id) ? 2 : 0) + noise.get(recipe.id)!;
    const weights = safe.map((recipe) => Math.exp(score(recipe) / TEMPERATURE));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const sample = () => {
      let roll = random.next() * total;
      for (let i = 0; i < safe.length; i++) { if ((roll -= weights[i]) < 0) return safe[i]; }
      return safe[safe.length - 1];
    };
    const id = `sim-${index + 1}`;
    const events = Array.from({ length: activity() }, () => ({
      userId: id, recipeId: sample().id, kind: pickKind(), at: new Date(START + random.next() * DAYS * DAY_MS), count: 1,
    })).sort((a, b) => a.at.getTime() - b.at.getTime());
    const { before: train, after: test } = splitLast(events);
    // Kiểm định: 20% cuối của tập huấn luyện; người chỉ có 1 tương tác huấn luyện thành "người mới" của tập kiểm định.
    const { before: trainInner, after: validation } = train.length >= 2 ? splitLast(train) : { before: [], after: train };
    const pantry = random.shuffle(allIngredients).slice(0, 6).map((name) => ({ name, daysLeft: Math.floor(random.next() * 12) }));
    return { id, index, group, profile, pantry, safe, events, train, test, trainInner, validation };
  });
  return users;
}

// ---------- Phương pháp gợi ý ----------
type Method = { name: string; recommend: (user: SimUser, history: Interaction[], model: CollaborativeModel, now: Date, limit: number) => string[] };
const pantryAt = (user: SimUser, now: Date): FitPantryItem[] => user.pantry.map(({ name, daysLeft }) => ({
  name, quantity: 500, unit: "G", expiryDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + daysLeft * DAY_MS),
}));
const engine = (weights: Record<Algorithm, number>, popularityWeight = 0) => (
  user: SimUser, history: Interaction[], model: CollaborativeModel, now: Date, limit: number,
) => {
  const data: EngineData = {
    userId: user.id, recipes, profile: user.profile, pantry: pantryAt(user, now), interactions: history, model, now,
    today: { calories: 0, proteinG: 0, meals: 0 },
  };
  return runRecommendation(data, { context: "for-you", limit, weights, popularityWeight }).items.map((item) => item.recipe.id);
};
const popularity = (events: Interaction[]) => {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.recipeId, (counts.get(event.recipeId) ?? 0) + 1);
  return [...recipes].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.id.localeCompare(b.id)).map((r) => r.id);
};

const WEIGHT_SETS: Array<{ name: string; weights: Record<Algorithm, number> }> = [
  { name: "Kế hoạch (0,45/0,30/0,25)", weights: { content: 0.45, collaborative: 0.3, knowledge: 0.25 } },
  { name: "Như Tổng quan (0,35/0,25/0,40)", weights: { content: 0.35, collaborative: 0.25, knowledge: 0.4 } },
  { name: "Bằng nhau (1/3)", weights: { content: 1 / 3, collaborative: 1 / 3, knowledge: 1 / 3 } },
  { name: "Nội dung mạnh (0,60/0,20/0,20)", weights: { content: 0.6, collaborative: 0.2, knowledge: 0.2 } },
  { name: "Cộng tác mạnh (0,30/0,50/0,20)", weights: { content: 0.3, collaborative: 0.5, knowledge: 0.2 } },
  { name: "Tri thức mạnh (0,25/0,25/0,50)", weights: { content: 0.25, collaborative: 0.25, knowledge: 0.5 } },
];

const baselineMethods = (allTrain: Interaction[], seed: number): Method[] => {
  const popular = popularity(allTrain);
  return [
    { name: "Ngẫu nhiên", recommend: (user, _h, _m, _n, limit) => rng(seed * 1000 + user.index).shuffle(user.safe).slice(0, limit).map((r) => r.id) },
    { name: "Phổ biến nhất", recommend: (user, _h, _m, _n, limit) => popular.filter((id) => user.safe.some((r) => r.id === id)).slice(0, limit) },
    { name: "Phổ biến nhất (không lọc an toàn)", recommend: (_u, _h, _m, _n, limit) => popular.slice(0, limit) },
  ];
};
const algorithmMethods: Method[] = [
  { name: "TT1 Nội dung", recommend: engine({ content: 1, collaborative: 0, knowledge: 0 }) },
  { name: "TT2 Cộng tác", recommend: engine({ content: 0, collaborative: 1, knowledge: 0 }) },
  { name: "TT3 Tri thức", recommend: engine({ content: 0, collaborative: 0, knowledge: 1 }) },
];

// ---------- Chỉ số ----------
type Row = Record<string, number>;
const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
const mean = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

function evaluate(users: SimUser[], method: Method, phase: "test" | "validation") {
  const historyOf = (user: SimUser) => (phase === "test" ? user.train : user.trainInner);
  const targetOf = (user: SimUser) => (phase === "test" ? user.test : user.validation);
  const model = buildCollaborativeModel(users.flatMap(historyOf), new Date(START + DAYS * DAY_MS));
  const evaluated = users.filter((user) => targetOf(user).length);
  const rows = evaluated.map((user) => {
    const history = historyOf(user);
    const now = targetOf(user)[0].at;
    const list = method.recommend(user, history, model, now, 10);
    const relevant = new Set(targetOf(user).map((event) => event.recipeId));
    const seen = new Set(history.map((event) => event.recipeId));
    const fresh = new Set([...relevant].filter((id) => !seen.has(id)));
    const target = mealTarget(user.profile, undefined, { calories: 0, proteinG: 0, meals: 0 });
    const top10 = list.slice(0, 10);
    const pairs: number[] = [];
    for (let i = 0; i < top10.length; i++) {
      for (let j = i + 1; j < top10.length; j++) pairs.push(similarity(space.vectors.get(top10[i])!, space.vectors.get(top10[j])!).score);
    }
    const row: Row = { history: history.length };
    for (const k of KS) {
      const top = list.slice(0, k);
      const hits = top.filter((id) => relevant.has(id)).length;
      row[`P@${k}`] = hits / k;
      row[`R@${k}`] = hits / relevant.size;
    }
    row["R@10 mới"] = fresh.size ? top10.filter((id) => fresh.has(id)).length / fresh.size : NaN;
    row.diversity = pairs.length ? 1 - mean(pairs) : 0;
    row.calorie = mean(top10.map((id) => Math.abs(byId.get(id)!.calories - target.calories) / target.calories));
    row.expiring = top10.some((id) => expiringFeature(byId.get(id)!, pantryAt(user, now), now).names.length > 0) ? 1 : 0;
    row.violations = top10.filter((id) => !recipeFit(byId.get(id)!, user.profile).safe).length / Math.max(1, top10.length);
    return { user, row, top10 };
  });
  const covered = new Set(rows.flatMap((entry) => entry.top10));
  const summary: Row = {};
  for (const key of ["P@5", "R@5", "P@10", "R@10", "diversity", "calorie", "expiring", "violations"]) summary[key] = mean(rows.map((entry) => entry.row[key]));
  summary["R@10 mới"] = mean(rows.map((entry) => entry.row["R@10 mới"]).filter((value) => !Number.isNaN(value)));
  summary.coverage = covered.size / recipes.length;
  const bucket = (count: number) => (count === 0 ? "0" : count <= 5 ? "1–5" : ">5");
  const buckets: Record<string, number[]> = { "0": [], "1–5": [], ">5": [] };
  for (const entry of rows) buckets[bucket(entry.row.history)].push(entry.row["R@10"]);
  return { summary, buckets };
}

// ---------- Chạy (5 seed, lấy trung bình) ----------
const fmt = (value: number, digits = 3) => value.toFixed(digits).replace(".", ",");
const pct = (value: number) => `${fmt(value * 100, 1)}%`;
const std = (values: number[]) => Math.sqrt(mean(values.map((value) => (value - mean(values)) ** 2)));
const started = Date.now();
const runs = SEEDS.map((seed) => ({ seed, users: simulate(seed) }));
const averageOf = (summaries: Row[]) => Object.fromEntries(Object.keys(summaries[0]).map((key) => [key, mean(summaries.map((row) => row[key]))]));

// 1. Chọn trọng số bộ trộn trên tập kiểm định (20% cuối của tập huấn luyện), không nhìn tập kiểm tra.
const validation = WEIGHT_SETS.map((set) => {
  const summaries = runs.map(({ users }) => evaluate(users, { name: set.name, recommend: engine(set.weights) }, "validation").summary);
  return { ...set, result: averageOf(summaries) };
});
const plan = validation[0];
const best = [...validation].sort((a, b) => b.result["R@10"] - a.result["R@10"] || b.result.diversity - a.result.diversity)[0];
// Quy tắc minh bạch: giữ bộ trọng số của kế hoạch trừ khi bộ khác hơn rõ (R@10 kiểm định trung bình cao hơn ít nhất 0,01).
const chosen = best.result["R@10"] - plan.result["R@10"] >= 0.01 ? best : plan;

// 1b. Thành phần phổ biến w_pop0 (khởi đầu lạnh), cùng quy tắc như bảng 3: giữ 0 (không có thành phần này) trừ khi giá trị khác
//     có R@10 kiểm định trung bình (tất cả người) cao hơn ít nhất 0,01. Ghi thêm R@10 kiểm định theo nhóm 0 và 1–5 tương tác.
const POPULARITY_CANDIDATES = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
const popularityValidation = POPULARITY_CANDIDATES.map((popularityWeight) => {
  const evaluations = runs.map(({ users }) => evaluate(users, { name: `w_pop0 = ${popularityWeight}`, recommend: engine(chosen.weights, popularityWeight) }, "validation"));
  return {
    popularityWeight,
    result: averageOf(evaluations.map((entry) => entry.summary)),
    cold: mean(evaluations.flatMap((entry) => entry.buckets["0"])),
    few: mean(evaluations.flatMap((entry) => entry.buckets["1–5"])),
  };
});
const noPopularity = popularityValidation[0];
const bestPopularity = [...popularityValidation].sort((a, b) => b.result["R@10"] - a.result["R@10"] || b.cold - a.cold)[0];
const chosenPopularity = bestPopularity.result["R@10"] - noPopularity.result["R@10"] >= 0.01 ? bestPopularity : noPopularity;

// 2. Đánh giá trên tập kiểm tra, mỗi seed một lần, rồi lấy trung bình (R@10 kèm độ lệch chuẩn giữa các seed).
const methodNames = [
  "Ngẫu nhiên", "Phổ biến nhất", "Phổ biến nhất (không lọc an toàn)", "TT1 Nội dung", "TT2 Cộng tác", "TT3 Tri thức", `Bộ trộn (${chosen.name})`,
  `Bộ trộn + phổ biến (w_pop0 = ${fmt(bestPopularity.popularityWeight, 1)}${bestPopularity === chosenPopularity ? "" : ", không đạt ngưỡng"})`,
];
const perSeed = runs.map(({ seed, users }) => {
  const methods: Method[] = [
    ...baselineMethods(users.flatMap((user) => user.train), seed), ...algorithmMethods, { name: methodNames[6], recommend: engine(chosen.weights) },
    { name: methodNames[7], recommend: engine(chosen.weights, bestPopularity.popularityWeight) },
  ];
  return methods.map((method) => evaluate(users, method, "test"));
});
const results = methodNames.map((name, index) => {
  const summaries = perSeed.map((seedResults) => seedResults[index].summary);
  const buckets: Record<string, number[]> = { "0": [], "1–5": [], ">5": [] };
  for (const seedResults of perSeed) for (const [key, values] of Object.entries(seedResults[index].buckets)) buckets[key].push(...values);
  return { name, summary: averageOf(summaries), recallStd: std(summaries.map((row) => row["R@10"])), buckets };
});

const totalEvents = runs.reduce((sum, { users }) => sum + users.reduce((acc, user) => acc + user.events.length, 0), 0);
const lines: string[] = [];
lines.push(`Sinh bằng \`npm run eval:recommend -w backend\`: ${SEEDS.length} lần mô phỏng (seed ${SEEDS[0]}–${SEEDS.at(-1)}), mỗi lần ${USERS} người, `
  + `${GROUPS.length} nhóm khẩu vị, ${DAYS} ngày; trung bình ${Math.round(totalEvents / SEEDS.length)} tương tác mỗi lần. Dữ liệu **mô phỏng**, `
  + `chỉ trong bộ nhớ, không có trong cơ sở dữ liệu. Ngữ cảnh "for-you", K = 5 và 10; số trong bảng là trung bình ${SEEDS.length} lần.`);
lines.push("");
lines.push("**Bảng 1 — Tập kiểm tra (20% tương tác cuối của mỗi người).**");
lines.push("");
lines.push("| Phương pháp | P@5 | R@5 | P@10 | R@10 (± độ lệch giữa các lần) | R@10 món mới | Độ phủ | Đa dạng | Lệch calo | Có đồ sắp hết hạn | Vi phạm an toàn |");
lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
for (const { name, summary, recallStd } of results) {
  lines.push(`| ${name} | ${fmt(summary["P@5"])} | ${fmt(summary["R@5"])} | ${fmt(summary["P@10"])} | ${fmt(summary["R@10"])} ± ${fmt(recallStd)} | `
    + `${fmt(summary["R@10 mới"])} | ${pct(summary.coverage)} | ${fmt(summary.diversity)} | ${pct(summary.calorie)} | ${pct(summary.expiring)} | ${pct(summary.violations)} |`);
}
lines.push("");
lines.push(`**Bảng 2 — R@10 theo số tương tác trong tập huấn luyện (khởi đầu lạnh; gộp người của ${SEEDS.length} lần).**`);
lines.push("");
const bucketKeys = ["0", "1–5", ">5"];
lines.push(`| Phương pháp | ${bucketKeys.map((key) => `${key} tương tác (${results[0].buckets[key].length} người)`).join(" | ")} |`);
lines.push(`|---|${bucketKeys.map(() => "---").join("|")}|`);
for (const { name, buckets } of results) lines.push(`| ${name} | ${bucketKeys.map((key) => fmt(mean(buckets[key]))).join(" | ")} |`);
lines.push("");
lines.push("**Bảng 3 — Chọn trọng số bộ trộn trên tập kiểm định (20% cuối của tập huấn luyện; tập kiểm tra không dùng để chọn).**");
lines.push("");
lines.push("| Bộ trọng số (nội dung/cộng tác/tri thức) | R@10 kiểm định | P@10 kiểm định | Đa dạng | Có đồ sắp hết hạn |");
lines.push("|---|---|---|---|---|");
for (const set of validation) {
  lines.push(`| ${set.name}${set === chosen ? " **(chọn)**" : ""} | ${fmt(set.result["R@10"])} | ${fmt(set.result["P@10"])} | ${fmt(set.result.diversity)} | ${pct(set.result.expiring)} |`);
}
lines.push("");
lines.push(`Quy tắc chọn: giữ bộ trọng số của kế hoạch trừ khi bộ khác có R@10 kiểm định trung bình cao hơn ít nhất 0,01. Bộ cao nhất: ${best.name} `
  + `(${fmt(best.result["R@10"])} so với ${fmt(plan.result["R@10"])}) → chọn **${chosen.name}**.`);
lines.push("");
lines.push(`**Bảng 4 — Chọn w_pop0 của thành phần phổ biến (khởi đầu lạnh) trên tập kiểm định, với bộ trọng số đã chọn.**`);
lines.push("");
lines.push("| w_pop0 | R@10 kiểm định, tất cả | R@10 kiểm định, 0 tương tác | R@10 kiểm định, 1–5 tương tác | Đa dạng | Có đồ sắp hết hạn |");
lines.push("|---|---|---|---|---|---|");
for (const entry of popularityValidation) {
  lines.push(`| ${fmt(entry.popularityWeight, 1)}${entry === chosenPopularity ? " **(chọn)**" : ""} | ${fmt(entry.result["R@10"])} | ${fmt(entry.cold)} | `
    + `${fmt(entry.few)} | ${fmt(entry.result.diversity)} | ${pct(entry.result.expiring)} |`);
}
lines.push("");
lines.push(`Quy tắc chọn (như bảng 3): giữ w_pop0 = 0 trừ khi giá trị khác có R@10 kiểm định (tất cả người) cao hơn ít nhất 0,01. Cao nhất: `
  + `w_pop0 = ${fmt(bestPopularity.popularityWeight, 1)} (${fmt(bestPopularity.result["R@10"])} so với ${fmt(noPopularity.result["R@10"])}) → chọn `
  + `**w_pop0 = ${fmt(chosenPopularity.popularityWeight, 1)}**.`);
lines.push("");
const before = results[6];
const after = results[7];
lines.push(`**Bảng 5 — Bộ trộn trước/sau khi thêm thành phần phổ biến w_pop0 = ${fmt(bestPopularity.popularityWeight, 1)} (giá trị tốt nhất ở bảng 4; `
  + `tập kiểm tra, R@10 theo số tương tác).**`);
lines.push("");
lines.push(`| Nhóm | Trước (w_pop0 = 0) | Sau (w_pop0 = ${fmt(bestPopularity.popularityWeight, 1)}) |`);
lines.push("|---|---|---|");
for (const key of bucketKeys) lines.push(`| ${key} tương tác (${before.buckets[key].length} người) | ${fmt(mean(before.buckets[key]))} | ${fmt(mean(after.buckets[key]))} |`);
lines.push(`| Tất cả | ${fmt(before.summary["R@10"])} | ${fmt(after.summary["R@10"])} |`);
lines.push("");
lines.push(`Thời gian chạy: ${((Date.now() - started) / 1000).toFixed(1)} s.`);

const output = lines.join("\n");
console.log(output);
const docPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../docs/thuat-toan-goi-y.md");
const doc = readFileSync(docPath, "utf8");
const START_MARK = "<!-- EVAL:START -->";
const END_MARK = "<!-- EVAL:END -->";
if (doc.includes(START_MARK) && doc.includes(END_MARK)) {
  writeFileSync(docPath, `${doc.slice(0, doc.indexOf(START_MARK) + START_MARK.length)}\n${output}\n${doc.slice(doc.indexOf(END_MARK))}`);
  console.log(`\nĐã ghi kết quả vào ${docPath}`);
} else {
  console.log(`\nChưa có dấu ${START_MARK} / ${END_MARK} trong ${docPath}: chỉ in ra màn hình.`);
}
