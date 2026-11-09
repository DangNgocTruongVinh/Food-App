import type { DietType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seedRecipesAsRecords } from "../../test/seed-recipes.js";
import { buildCollaborativeModel } from "./collaborative.js";
import { type EngineData, type EngineRecipe, runRecommendation } from "./hybrid.js";
import type { Interaction } from "./interactions.js";

// Đo thời gian một lần gợi ý (GĐ3b-R5). Chạy riêng bằng `npm run test:perf -w backend` (không song song với các test khác,
// vì máy bận làm số đo không đáng tin); bộ test thường (`npm test`) bỏ qua file *.perf.test.ts.

const day = 86_400_000;
const now = new Date("2026-11-03T03:00:00.000Z");
const at = (offsetDays: number) => new Date(Date.UTC(2026, 10, 3) + offsetDays * day);
const item = (name: string, expiryDays: number | null, quantity = 100) => ({ name, quantity, unit: "G" as const, expiryDate: expiryDays === null ? null : at(expiryDays) });
const seed = seedRecipesAsRecords() as unknown as EngineRecipe[];
const engine = (patch: Partial<EngineData> = {}): EngineData => ({
  userId: "demo", recipes: seed, now,
  profile: { dietType: "BALANCED", allergies: [], dislikedFoods: [], preferredCuisines: ["Việt Nam"], mealsPerDay: 3, dailyCalorieTarget: 1800, proteinTargetG: 90 },
  pantry: [item("Đậu hũ", 1, 300), item("Ức gà", 2, 500), item("Gạo", 90, 2000)],
  interactions: [], model: buildCollaborativeModel([], now), today: { calories: 0, proteinG: 0, meals: 0 }, ...patch,
});

describe("Recommendation performance", () => {
  it("answers in < 150 ms: 33 recipes, and 500 recipes × 1,000 users in memory", { timeout: 30_000 }, () => {
    // Lấy lần nhanh nhất trong 5 lần (bỏ ảnh hưởng của các test khác chạy song song); lần đầu làm nóng cache đặc trưng.
    const time = (data: EngineData) => {
      runRecommendation(data, { context: "today", limit: 6 });
      return Math.min(...Array.from({ length: 5 }, () => {
        const started = performance.now();
        runRecommendation(data, { context: "today", limit: 6 });
        return performance.now() - started;
      }));
    };
    const small = time(engine());
    expect(small).toBeLessThan(150);
    let state = 7;
    const random = () => (state = (state * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    const big = Array.from({ length: 500 }, (_, index) => {
      const template = seed[index % seed.length];
      return { ...template, id: `r${index}`, slug: `r${index}`, calories: template.calories + (index % 7) * 20 };
    });
    const interactions: Interaction[] = [];
    for (let user = 0; user < 1000; user++) {
      for (let n = 0; n < 20; n++) interactions.push({ userId: `u${user}`, recipeId: `r${Math.floor(random() * 500)}`, kind: "EATEN", at: at(-Math.floor(random() * 30)), count: 1 });
    }
    const model = buildCollaborativeModel(interactions, now);
    const history = interactions.filter((entry) => entry.userId === "u1");
    // Hồ sơ có dị ứng và món không thích (lọc an toàn phải so từng món).
    const strict = { dietType: "BALANCED" as DietType, allergies: ["Hải sản", "Đậu phộng"], dislikedFoods: ["Hành tây"], mealsPerDay: 3 };
    const large = time(engine({ recipes: big, model, userId: "u1", interactions: history, profile: strict }));
    expect(large).toBeLessThan(150);
  });
});
