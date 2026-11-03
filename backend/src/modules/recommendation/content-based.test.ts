import type { DietType, MealType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seedRecipesAsRecords } from "../../test/seed-recipes.js";
import { contentScores, interactionWeight, profilePrior, similarRecipes, userVector } from "./content-based.js";
import {
  BLOCK_WEIGHTS, BLOCKS, buildFeatureSpace, catalogVersion, dot, type FeatureRecipe, getFeatureSpace, idfOf, similarity, topBlock,
} from "./features.js";
import type { Interaction } from "./interactions.js";

const day = 86_400_000;
const now = new Date("2026-11-03T03:00:00.000Z");
let counter = 0;
const recipe = (id: string, ingredients: Array<string | [string, true]>, patch: Partial<FeatureRecipe> = {}): FeatureRecipe => ({
  id, cuisine: "Việt Nam", mealTypes: ["LUNCH"] as MealType[], dietTags: ["BALANCED"] as DietType[],
  calories: 400 + (counter++ % 3) * 100, proteinG: 20, carbsG: 50, fatG: 10, updatedAt: new Date(0),
  ingredients: ingredients.map((entry) => (Array.isArray(entry) ? { name: entry[0], optional: true } : { name: entry })),
  ...patch,
});

describe("Content features (TF-IDF and blocks)", () => {
  const a = recipe("a", ["Tỏi", "Ức gà"]);
  const b = recipe("b", ["tỏi", "Cá lóc"]);
  const c = recipe("c", ["Gạo", ["Hành lá", true]]);
  const space = buildFeatureSpace([a, b, c]);

  it("computes IDF by hand: idf = ln((1+N)/(1+df)) + 1, names matched loosely", () => {
    expect(space.idf.get("tỏi")).toBeCloseTo(Math.log(4 / 3) + 1, 12);
    expect(space.idf.get("ức gà")).toBeCloseTo(Math.log(4 / 2) + 1, 12);
    expect(idfOf(3, 1)).toBeCloseTo(Math.log(2) + 1, 12);
    const tf = space.vectors.get("a")!.ingredients;
    const [garlic, chicken] = [Math.log(4 / 3) + 1, Math.log(2) + 1];
    const length = Math.hypot(garlic, chicken);
    expect(tf.get("tỏi")).toBeCloseTo(garlic / length, 12);
    expect(tf.get("ức gà")).toBeCloseTo(chicken / length, 12);
  });

  it("gives optional ingredients tf = 0.5", () => {
    const ingredients = space.vectors.get("c")!.ingredients;
    expect(ingredients.get("hành lá")! / ingredients.get("gạo")!).toBeCloseTo(0.5, 12);
  });

  it("L2-normalizes every non-empty block", () => {
    for (const vector of space.vectors.values()) {
      for (const block of BLOCKS) if (vector[block].size) expect(dot(vector[block], vector[block])).toBeCloseTo(1, 12);
    }
  });

  it("clips nutrition z-scores at ±3 and ignores a nutrient with zero spread", () => {
    const outlier = recipe("x", ["Gạo"], { calories: 100_000 });
    const flat = buildFeatureSpace([...Array.from({ length: 20 }, (_, i) => recipe(`n${i}`, ["Gạo"], { calories: 500 })), outlier]);
    expect(flat.nutrition.proteinG.std).toBe(0);
    const block = flat.vectors.get("x")!.nutrition;
    expect([...block.keys()]).toEqual(["calories"]);
    expect(block.get("calories")).toBeCloseTo(1, 12);
  });

  it("weighted sum of block cosines equals the cosine of the concatenated √w-weighted vectors (all blocks non-empty)", () => {
    const seed = buildFeatureSpace(seedRecipesAsRecords());
    const ids = [...seed.vectors.keys()];
    const concat = (id: string) => BLOCKS.flatMap((block) => [...seed.vectors.get(id)![block]].map(([key, value]) => [`${block}:${key}`, Math.sqrt(BLOCK_WEIGHTS[block]) * value] as const));
    const cosine = (x: string, y: string) => {
      const vx = new Map(concat(x));
      const vy = new Map(concat(y));
      const d = [...vx].reduce((sum, [key, value]) => sum + value * (vy.get(key) ?? 0), 0);
      return d / (Math.sqrt([...vx.values()].reduce((s, v) => s + v * v, 0)) * Math.sqrt([...vy.values()].reduce((s, v) => s + v * v, 0)));
    };
    let checked = 0;
    for (const x of ids.slice(0, 8)) {
      for (const y of ids.slice(8, 16)) {
        if (!BLOCKS.every((block) => seed.vectors.get(x)![block].size && seed.vectors.get(y)![block].size)) continue;
        expect(similarity(seed.vectors.get(x)!, seed.vectors.get(y)!).score).toBeCloseTo(cosine(x, y), 12);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("caches the space by catalog version (count + latest updatedAt)", () => {
    const recipes = [a, b, c];
    const first = getFeatureSpace(recipes);
    expect(getFeatureSpace([...recipes])).toBe(first);
    const edited = [a, b, { ...c, updatedAt: new Date(5) }];
    expect(catalogVersion(edited)).toBe("3:5");
    expect(getFeatureSpace(edited)).not.toBe(first);
  });

  it("names the largest positive block as the reason", () => {
    expect(topBlock({ ingredients: 0.1, cuisine: 0.15, meal: 0, diet: 0, nutrition: -0.2 })).toBe("cuisine");
    expect(topBlock({ ingredients: 0, cuisine: 0, meal: 0, diet: 0, nutrition: -0.1 })).toBeNull();
  });
});

describe("Content-based scores (algorithm 1)", () => {
  // Cùng dinh dưỡng → khối dinh dưỡng rỗng, kết quả chỉ phụ thuộc nguyên liệu, ẩm thực, nhãn.
  const same = { calories: 500 };
  const recipes = [
    recipe("ga-xao", ["Ức gà", "Tỏi", "Gừng"], same),
    recipe("ga-luoc", ["Ức gà", "Gừng", "Muối"], same),
    recipe("ca-kho", ["Cá lóc", "Nước mắm", "Tiêu"], same),
    recipe("sushi", ["Gạo", "Cá hồi", "Rong biển"], { ...same, cuisine: "Nhật Bản", dietTags: ["HIGH_PROTEIN"] }),
  ];
  const space = buildFeatureSpace(recipes);
  const eaten = (recipeId: string, daysAgo: number, kind: Interaction["kind"] = "EATEN"): Interaction => ({
    userId: "u", recipeId, kind, at: new Date(now.getTime() - daysAgo * day), count: 1,
  });

  it("weights interactions by kind and decays them with τ = 30 days", () => {
    expect(interactionWeight(eaten("ga-xao", 0), now)).toBeCloseTo(3, 12);
    expect(interactionWeight(eaten("ga-xao", 30), now)).toBeCloseTo(3 * Math.exp(-1), 12);
    expect(interactionWeight(eaten("ga-xao", 60, "LIKED"), now)).toBeCloseTo(2 * Math.exp(-2), 12);
    expect(interactionWeight(eaten("ga-xao", 0, "PLANNED"), now)).toBeCloseTo(0.5, 12);
    expect(interactionWeight({ ...eaten("ga-xao", 0), count: 2 }, now)).toBeCloseTo(6, 12);
    expect(interactionWeight(eaten("ga-xao", -2), now)).toBeCloseTo(3, 12);
  });

  it("ranks recipes similar to what the user ate, with the shared ingredients as reason", () => {
    const user = userVector(null, [eaten("ga-xao", 1)], space, now);
    const scores = contentScores(user, ["ga-luoc", "ca-kho", "sushi"], space);
    expect(scores[0]).toMatchObject({ recipeId: "ga-luoc", top: "ingredients" });
    expect([...scores[0].ingredients].sort()).toEqual(["Gừng", "Ức gà"]);
  });

  it("lets recent history outweigh old history", () => {
    const recentFish = userVector(null, [eaten("ga-xao", 90), eaten("ca-kho", 1)], space, now);
    const recentChicken = userVector(null, [eaten("ga-xao", 1), eaten("ca-kho", 90)], space, now);
    const top = (vector: ReturnType<typeof userVector>) => contentScores(vector, ["ga-luoc", "ca-kho"], space)[0].recipeId;
    expect(top(recentFish)).toBe("ca-kho");
    expect(top(recentChicken)).toBe("ga-luoc");
  });

  it("uses only the profile prior for a user without history (cold start)", () => {
    const profile = { preferredCuisines: ["Nhật Bản"], dietType: "HIGH_PROTEIN" as DietType };
    const user = userVector(profile, [], space, now);
    const [first] = contentScores(user, recipes.map((r) => r.id), space);
    expect(first).toMatchObject({ recipeId: "sushi", top: "cuisine" });
    expect(first.blocks.cuisine).toBeCloseTo(BLOCK_WEIGHTS.cuisine, 12);
    expect(first.blocks.diet).toBeCloseTo(BLOCK_WEIGHTS.diet, 12);
    expect(user.ingredients.size).toBe(0);
    expect(profilePrior(null, space).cuisine.size).toBe(0);
    const empty = contentScores(userVector(null, [], space, now), recipes.map((r) => r.id), space);
    expect(empty.every((entry) => entry.score === 0 && entry.top === null)).toBe(true);
  });

  it("ignores history of recipes no longer in the catalog", () => {
    const user = userVector(null, [{ ...eaten("da-xoa", 0) }], space, now);
    expect(BLOCKS.every((block) => user[block].size === 0)).toBe(true);
  });

  it("finds similar recipes by cosine, excluding the recipe itself", () => {
    const similar = similarRecipes(space, "ga-xao", recipes.map((r) => r.id), 2);
    expect(similar.map((entry) => entry.recipeId)).toEqual(["ga-luoc", "ca-kho"]);
    expect(similarRecipes(space, "khong-co", ["ga-luoc"])).toEqual([]);
  });

  it("works on the seed catalog: finite scores, a recipe's nearest neighbour is not itself", () => {
    const seed = seedRecipesAsRecords();
    const seedSpace = buildFeatureSpace(seed);
    for (const item of seed) {
      const [first] = similarRecipes(seedSpace, item.id, seed.map((r) => r.id), 1);
      expect(first.recipeId).not.toBe(item.id);
      expect(Number.isFinite(first.score)).toBe(true);
      expect(first.score).toBeLessThanOrEqual(1 + 1e-9);
    }
  });
});
