import type { DietType, MealType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seedRecipesAsRecords } from "../../test/seed-recipes.js";
import { buildCollaborativeModel } from "./collaborative.js";
import { buildFeatureSpace } from "./features.js";
import {
  blendScores, coldStartWeights, CONTEXT_WEIGHTS, type EngineData, type EngineRecipe, minMax, mmr, runRecommendation,
} from "./hybrid.js";
import type { Interaction } from "./interactions.js";
import {
  diversityFeature, expiringFeature, KNOWLEDGE_WEIGHTS, knowledgeScore, mealTarget, nutritionFeature, pantryFeature, usesPantryItem,
} from "./knowledge-based.js";
import { contentReason, FALLBACK_REASON, knowledgeReason, recommendationReason, similarReason } from "./reasons.js";

const day = 86_400_000;
const now = new Date("2026-11-03T03:00:00.000Z");
const at = (offsetDays: number) => new Date(Date.UTC(2026, 10, 3) + offsetDays * day);
const item = (name: string, expiryDays: number | null, quantity = 100) => ({ name, quantity, unit: "G" as const, expiryDate: expiryDays === null ? null : at(expiryDays) });
const ing = (name: string, optional = false) => ({ name, quantity: 100, unit: "G" as const, optional });
const recipe = (id: string, ingredients: Array<ReturnType<typeof ing>>, patch: Partial<EngineRecipe> = {}): EngineRecipe => ({
  id, slug: id, name: id, imageUrl: null, prepMinutes: 10, cookMinutes: 10, cuisine: "Việt Nam", mealTypes: ["LUNCH"] as MealType[],
  dietTags: ["BALANCED"] as DietType[], calories: 500, proteinG: 30, carbsG: 50, fatG: 15, updatedAt: new Date(0), hiddenAt: null,
  ingredients, ...patch,
});

describe("Algorithm 3 features", () => {
  it("f_exp: Σ (D+1−d)/(D+1) over pantry items expiring within 3 days that the recipe uses, capped at 1", () => {
    const pantry = [item("Đậu hũ", 0), item("Ức gà", 2), item("Gạo", 30), item("Sữa", -1)];
    expect(expiringFeature({ ingredients: [ing("Đậu hũ")] }, pantry, now)).toEqual({ value: 1, names: ["Đậu hũ"] });
    expect(expiringFeature({ ingredients: [ing("Ức gà")] }, pantry, now).value).toBeCloseTo(0.5, 12);
    expect(expiringFeature({ ingredients: [ing("Ức gà"), ing("Đậu hũ")] }, pantry, now)).toEqual({ value: 1, names: ["Đậu hũ", "Ức gà"] });
    expect(expiringFeature({ ingredients: [ing("Gạo"), ing("Sữa")] }, pantry, now).value).toBe(0);
    expect(expiringFeature({ ingredients: [ing("Ức gà")] }, [item("Ức gà", 3)], now).value).toBeCloseTo(0.25, 12);
  });

  it("f_kho: share of required ingredients in the pantry (optional and expired ones do not count)", () => {
    const pantry = [item("Gạo", 30), item("Trứng", null), item("Sữa", -1)];
    expect(pantryFeature({ ingredients: [ing("Gạo"), ing("Trứng"), ing("Hành", true)] }, pantry, now)).toEqual({ value: 1, inPantry: 2, required: 2 });
    expect(pantryFeature({ ingredients: [ing("Gạo"), ing("Sữa"), ing("Muối"), ing("Tiêu")] }, pantry, now).value).toBeCloseTo(0.25, 12);
    expect(pantryFeature({ ingredients: [ing("Hành", true)] }, pantry, now).value).toBe(0);
  });

  it("f_dd: Gaussian on calories (σ = 35% of target) plus protein share", () => {
    const target = { calories: 600, proteinG: 30 };
    expect(nutritionFeature({ calories: 600, proteinG: 30 }, target)).toBeCloseTo(1, 12);
    expect(nutritionFeature({ calories: 810, proteinG: 15 }, target)).toBeCloseTo(0.6 * Math.exp(-0.5) + 0.4 * 0.5, 12);
    expect(nutritionFeature({ calories: 600, proteinG: 0 }, { calories: 0, proteinG: 0 })).toBeCloseTo(0.4, 12);
  });

  it("f_dạng: 1 − max cosine with recent meals; the same recipe gives 0; nothing recent gives 1", () => {
    const space = buildFeatureSpace([recipe("a", [ing("Tỏi")]), recipe("b", [ing("Tỏi")]), recipe("c", [ing("Gạo")], { cuisine: "Ý", mealTypes: ["DINNER"] })]);
    expect(diversityFeature("a", [], space)).toBe(1);
    expect(diversityFeature("a", ["a"], space)).toBe(0);
    // a, b giống hệt trừ khối dinh dưỡng (mọi món cùng dinh dưỡng → khối rỗng, đóng góp 0): cos = 1 − w_dinh dưỡng = 0,8.
    expect(diversityFeature("a", ["b"], space)).toBeCloseTo(0.2, 9);
    expect(diversityFeature("a", ["c"], space)).toBeGreaterThan(0.8);
  });

  it("weights the parts with α = 0.35/0.25/0.20/0.10/0.10 and adds the diet preference", () => {
    const space = buildFeatureSpace([recipe("a", [ing("Đậu hũ")], { dietTags: ["HIGH_PROTEIN"] })]);
    const score = knowledgeScore(recipe("a", [ing("Đậu hũ")], { dietTags: ["HIGH_PROTEIN"] }), {
      pantry: [item("Đậu hũ", 0)], dietType: "HIGH_PROTEIN", target: { calories: 500, proteinG: 30 }, recentRecipeIds: [], space, now,
    });
    expect(score.parts).toEqual({
      expiring: KNOWLEDGE_WEIGHTS.expiring, pantry: KNOWLEDGE_WEIGHTS.pantry, nutrition: expect.closeTo(KNOWLEDGE_WEIGHTS.nutrition, 12),
      diversity: KNOWLEDGE_WEIGHTS.diversity, preference: KNOWLEDGE_WEIGHTS.preference,
    });
    expect(score.score).toBeCloseTo(1, 12);
  });

  it("meal target: remaining calories split over remaining meals once something was eaten, else the meal share", () => {
    const profile = { dailyCalorieTarget: 2000, proteinTargetG: 100, mealsPerDay: 3 };
    expect(mealTarget(profile, "LUNCH", { calories: 0, proteinG: 0, meals: 0 })).toEqual({ calories: 700, proteinG: 35 });
    expect(mealTarget(profile, undefined, { calories: 0, proteinG: 0, meals: 0 }).calories).toBeCloseTo(2000 / 3, 9);
    expect(mealTarget(profile, "DINNER", { calories: 800, proteinG: 40, meals: 1 })).toEqual({ calories: 600, proteinG: 30 });
    expect(mealTarget(profile, "DINNER", { calories: 2500, proteinG: 120, meals: 3 })).toEqual({ calories: 0, proteinG: 0 });
  });

  it("\"suggest for item X\" requires a recipe that uses that item", () => {
    expect(usesPantryItem({ ingredients: [ing("đậu  hũ")] }, item("Đậu hũ", 1))).toBe(true);
    expect(usesPantryItem({ ingredients: [ing("Đậu hũ")] }, item("Ức gà", 1))).toBe(false);
    expect(usesPantryItem({ ingredients: [ing("Đậu hũ")] }, item("Đậu hũ", 1, 0))).toBe(true);
  });
});

describe("Hybrid blending", () => {
  it("min–max normalizes to [0, 1] and gives 0 to everyone when all scores are equal", () => {
    expect([...minMax(new Map([["a", 2], ["b", 4], ["c", 3]]), ["a", "b", "c"]).values()]).toEqual([0, 1, 0.5]);
    expect([...minMax(new Map([["a", 5], ["b", 5]]), ["a", "b"]).values()]).toEqual([0, 0]);
    expect([...minMax(new Map([["a", 1]]), ["a", "missing"]).values()]).toEqual([1, 0]);
  });

  it("cold start: γ = n/(n+10) scales the collaborative weight and moves the rest to content and knowledge proportionally", () => {
    const fresh = coldStartWeights(CONTEXT_WEIGHTS.today, 0);
    expect(fresh.collaborative).toBe(0);
    expect(fresh.content).toBeCloseTo(0.35 + 0.25 * (0.35 / 0.75), 12);
    expect(fresh.knowledge).toBeCloseTo(0.4 + 0.25 * (0.4 / 0.75), 12);
    const active = coldStartWeights(CONTEXT_WEIGHTS.today, 10);
    expect(active.collaborative).toBeCloseTo(0.125, 12);
    for (const weights of [fresh, active, coldStartWeights(CONTEXT_WEIGHTS["for-you"], 3)]) {
      expect(weights.content + weights.collaborative + weights.knowledge).toBeCloseTo(1, 12);
    }
  });

  it("blends normalized scores with the weights and keeps each weighted component", () => {
    const blended = blendScores(["a", "b"], {
      content: new Map([["a", 1], ["b", 0]]), collaborative: new Map(), knowledge: new Map([["a", 0], ["b", 2]]),
    }, { content: 0.3, collaborative: 0.2, knowledge: 0.5 });
    expect(blended.map((entry) => entry.recipeId)).toEqual(["b", "a"]);
    expect(blended[0].components).toEqual({ content: 0, collaborative: 0, knowledge: 0.5 });
    expect(blended[1]).toMatchObject({ score: 0.3, components: { content: 0.3, collaborative: 0, knowledge: 0 } });
  });

  it("MMR avoids a list of near-duplicates: λ·score − (1−λ)·max similarity to what was picked", () => {
    const space = buildFeatureSpace([
      recipe("ga-1", [ing("Ức gà"), ing("Tỏi")]), recipe("ga-2", [ing("Ức gà"), ing("Tỏi")]),
      recipe("chay", [ing("Đậu hũ"), ing("Nấm")], { cuisine: "Nhật Bản", dietTags: ["VEGAN"], mealTypes: ["DINNER"] }),
    ]);
    // ga-2: 0,8·0,85 − 0,2·0,8 = 0,52 < chay: 0,8·0,7 − 0 = 0,56.
    const items = [{ recipeId: "ga-1", score: 1 }, { recipeId: "ga-2", score: 0.85 }, { recipeId: "chay", score: 0.7 }]
      .map((entry) => ({ ...entry, components: { content: entry.score, collaborative: 0, knowledge: 0 } }));
    expect(mmr(items, space, 2).map((entry) => entry.recipeId)).toEqual(["ga-1", "chay"]);
    expect(mmr(items, space, 3, 1).map((entry) => entry.recipeId)).toEqual(["ga-1", "ga-2", "chay"]);
  });

  it("writes the reason from the largest contributing component, then its largest sub-criterion", () => {
    const knowledge = {
      recipeId: "a", score: 0.5, expiringNames: ["Đậu hũ", "Ức gà"], pantryCount: 2, requiredCount: 3,
      parts: { expiring: 0.3, pantry: 0.15, nutrition: 0.05, diversity: 0, preference: 0 },
    };
    const content = { recipeId: "a", score: 0.4, blocks: { ingredients: 0.3, cuisine: 0.1, meal: 0, diet: 0, nutrition: 0 }, top: "ingredients" as const, ingredients: ["Tỏi", "Gừng"] };
    const base = { recipe: { cuisine: "Việt Nam" }, recipeName: (id: string) => ({ x: "Cá kho tộ" })[id], target: { calories: 600, proteinG: 30 } };
    expect(recommendationReason({ ...base, algorithm: "knowledge", knowledge, content }, ["knowledge", "content"])).toBe("Dùng 2 thực phẩm sắp hết hạn: Đậu hũ, Ức gà");
    expect(recommendationReason({ ...base, algorithm: "content", knowledge, content }, ["content", "knowledge"])).toBe("Có nguyên liệu bạn hay dùng: Tỏi, Gừng");
    expect(recommendationReason({ ...base, algorithm: "collaborative", collaborative: { recipeId: "a", score: 1, because: "x" } }, ["collaborative"]))
      .toBe("Người hay nấu Cá kho tộ cũng nấu món này");
    expect(knowledgeReason({ ...knowledge, parts: { ...knowledge.parts, expiring: 0 } }, base)).toBe("Có sẵn 2/3 nguyên liệu trong kho");
    expect(knowledgeReason({ ...knowledge, parts: { expiring: 0, pantry: 0, nutrition: 0.2, diversity: 0, preference: 0 } }, { ...base, mealType: "DINNER" }))
      .toBe("Vừa với khoảng 600 kcal của bữa tối");
    expect(contentReason({ ...content, top: "cuisine" }, "Nhật Bản")).toBe("Món Nhật Bản, hợp khẩu vị của bạn");
    // Chưa có lịch sử: lý do theo hồ sơ, không nói "món bạn hay…".
    expect(contentReason({ ...content, top: "cuisine" }, "Nhật Bản", false)).toBe("Món Nhật Bản, đúng ẩm thực bạn thích");
    expect(contentReason({ ...content, top: "nutrition" }, null, false)).toBe("Dinh dưỡng hợp mục tiêu trong hồ sơ của bạn");
    expect(similarReason({ ...content, top: "nutrition" }, "Việt Nam")).toBe("Cùng nguyên liệu: Tỏi, Gừng");
    expect(similarReason({ ...content, ingredients: [], top: "cuisine" }, "Việt Nam")).toBe("Cùng ẩm thực Việt Nam");
    expect(recommendationReason({ ...base, algorithm: null }, [])).toBe(FALLBACK_REASON);
  });
});

// ---------- Luồng đầy đủ trên bộ món seed ----------
const seed = seedRecipesAsRecords() as unknown as EngineRecipe[];
const bySlug = new Map(seed.map((entry) => [entry.slug, entry.id]));
const engine = (patch: Partial<EngineData> = {}): EngineData => ({
  userId: "demo", recipes: seed, now,
  profile: { dietType: "BALANCED", allergies: [], dislikedFoods: [], preferredCuisines: ["Việt Nam"], mealsPerDay: 3, dailyCalorieTarget: 1800, proteinTargetG: 90 },
  pantry: [item("Đậu hũ", 1, 300), item("Ức gà", 2, 500), item("Gạo", 90, 2000)],
  interactions: [], model: buildCollaborativeModel([], now), today: { calories: 0, proteinG: 0, meals: 0 }, ...patch,
});

describe("runRecommendation on the seed catalog", () => {
  it("today: puts dishes using soon-expiring items first, each with a reason; cold start without history", () => {
    const result = runRecommendation(engine(), { context: "today", limit: 3 });
    expect(result.coldStart).toBe(true);
    expect(result.items).toHaveLength(3);
    expect(result.items[0].reason).toMatch(/sắp hết hạn/);
    for (const entry of result.items) expect(entry.reason.length).toBeGreaterThan(5);
  });

  it("pantry context only suggests dishes using something in the pantry; focus item requires that item", () => {
    const pantryResult = runRecommendation(engine(), { context: "pantry", limit: 12 });
    expect(pantryResult.items.length).toBeGreaterThan(0);
    const focus = runRecommendation(engine(), { context: "pantry", limit: 12, focusItem: item("Đậu hũ", 1) });
    for (const entry of focus.items) expect(seed.find((r) => r.id === entry.recipe.id)!.ingredients.some((i) => i.name === "Đậu hũ")).toBe(true);
  });

  it("similar excludes the base recipe; also-cooked uses the collaborative model (aggregate only)", () => {
    const base = bySlug.get("bun-xao-chay")!;
    const similar = runRecommendation(engine(), { context: "similar", recipeId: base, limit: 4 });
    expect(similar.items.map((entry) => entry.recipe.id)).not.toContain(base);
    expect(similar.items[0].reason).toBeTruthy();
    const interactions: Interaction[] = ["u1", "u2", "u3"].flatMap((userId) => ["bun-xao-chay", "nam-kho-tieu"].map((slug) => ({
      userId, recipeId: bySlug.get(slug)!, kind: "EATEN" as const, at: now, count: 1,
    })));
    const also = runRecommendation(engine({ model: buildCollaborativeModel(interactions, now) }), { context: "also-cooked", recipeId: base, limit: 4 });
    expect(also.items.map((entry) => entry.recipe.slug)).toEqual(["nam-kho-tieu"]);
    expect(also.items[0].reason).toBe("Người nấu Bún xào chay cũng nấu món này");
  });

  it("uses history: content and collaborative components appear for an active user", () => {
    const history: Interaction[] = ["ga-xao-sa-ot", "bo-xao-bong-cai", "ca-hap-gung-hanh"].map((slug) => ({
      userId: "demo", recipeId: bySlug.get(slug)!, kind: "EATEN" as const, at: at(-5), count: 1,
    }));
    const others: Interaction[] = ["u1", "u2", "u3"].flatMap((userId) => ["ga-xao-sa-ot", "bo-xao-bong-cai", "chao-ga-hanh-gung"].map((slug) => ({
      userId, recipeId: bySlug.get(slug)!, kind: "EATEN" as const, at: at(-2), count: 1,
    })));
    const model = buildCollaborativeModel([...history, ...others], now);
    const result = runRecommendation(engine({ interactions: history, model }), { context: "for-you", limit: 6 });
    expect(result.items.some((entry) => entry.components.content > 0)).toBe(true);
    expect(result.items.find((entry) => entry.recipe.slug === "chao-ga-hanh-gung")?.components.collaborative).toBeGreaterThan(0);
    // Món đã ăn vẫn có thể được gợi ý lại (thuật toán 1, 3), nhưng thuật toán 2 không dự đoán cho món đã tương tác.
    const eatenAgain = result.items.find((entry) => entry.recipe.slug === "ga-xao-sa-ot");
    if (eatenAgain) expect(eatenAgain.components.collaborative).toBe(0);
  });
});
