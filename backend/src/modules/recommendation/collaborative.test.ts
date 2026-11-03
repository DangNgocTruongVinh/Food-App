import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  alsoCooked, buildCollaborativeModel, buildRatings, collaborativeScores, interactedCount, itemNeighbors, MIN_SUPPORT,
} from "./collaborative.js";
import { type Interaction, loadCollaborativeInteractions, loadUserInteractions } from "./interactions.js";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("../../lib/prisma.js", () => ({ prisma: { $queryRaw: mocks.queryRaw } }));

const day = 86_400_000;
const now = new Date("2026-11-03T03:00:00.000Z");
const ate = (userId: string, recipeId: string, daysAgo = 0, kind: Interaction["kind"] = "EATEN", count = 1): Interaction => ({
  userId, recipeId, kind, at: new Date(now.getTime() - daysAgo * day), count,
});
/** Mỗi người trong `users` đã ăn mọi món trong `recipes` (hôm nay, 1 lần). */
const everyone = (users: string[], recipes: string[]) => users.flatMap((user) => recipes.map((recipe) => ate(user, recipe)));

beforeEach(() => vi.resetAllMocks());

describe("Ratings r_ui", () => {
  it("is ln(1 + Σ ω·count·e^(−Δ/30)) with ω: eaten 3, posted 3, liked 2; \"planned\" is ignored", () => {
    const ratings = buildRatings([
      ate("u", "a", 0), ate("u", "a", 30, "LIKED"), ate("u", "b", 0, "POSTED", 2), ate("u", "c", 0, "PLANNED"),
    ], now);
    expect(ratings.get("u")!.get("a")).toBeCloseTo(Math.log(1 + 3 + 2 * Math.exp(-1)), 12);
    expect(ratings.get("u")!.get("b")).toBeCloseTo(Math.log(1 + 6), 12);
    expect(ratings.get("u")!.has("c")).toBe(false);
  });
});

describe("Item similarity with shrinkage", () => {
  it("is cosine × n/(n+λ), computed by hand", () => {
    // u1 ăn a, b; u2 ăn a. r = ln(4) cho mỗi tương tác.
    const r = Math.log(4);
    const neighbors = itemNeighbors(buildRatings([ate("u1", "a"), ate("u1", "b"), ate("u2", "a")], now), 5, 20);
    const cosine = (r * r) / (Math.sqrt(2 * r * r) * Math.sqrt(r * r));
    expect(neighbors.get("a")).toEqual([{ recipeId: "b", similarity: expect.closeTo(cosine * (1 / 6), 12), support: 1 }]);
    expect(neighbors.get("b")![0].similarity).toBeCloseTo(neighbors.get("a")![0].similarity, 12);
  });

  it("shrinks pairs seen by few users more than pairs seen by many (same cosine)", () => {
    const few = itemNeighbors(buildRatings(everyone(["u1"], ["a", "b"]), now));
    const many = itemNeighbors(buildRatings(everyone(["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10"], ["a", "b"]), now));
    expect(few.get("a")![0].similarity).toBeCloseTo(1 / 6, 12);
    expect(many.get("a")![0].similarity).toBeCloseTo(10 / 15, 12);
    expect(itemNeighbors(buildRatings(everyone(["u1"], ["a", "b"]), now), 0).get("a")![0].similarity).toBeCloseTo(1, 12);
  });

  it("keeps only the k nearest neighbours", () => {
    const neighbors = itemNeighbors(buildRatings(everyone(["u1", "u2"], ["a", "b", "c", "d", "e"]), now), 5, 2);
    expect(neighbors.get("a")).toHaveLength(2);
  });
});

describe("Predictions and cold start", () => {
  // 3 người ăn a, b, c; người đang xem v ăn a.
  const model = buildCollaborativeModel([...everyone(["u1", "u2", "u3"], ["a", "b", "c"]), ate("v", "a"), ate("w", "z")], now);

  it("scores unseen recipes Σ sim·r over the user's neighbours, with the top contributor as reason", () => {
    const scores = collaborativeScores(model, "v", ["a", "b", "c", "z"]);
    expect(scores.map((entry) => entry.recipeId)).toEqual(["b", "c", "z"]);
    const r = Math.log(4);
    const simAB = model.neighbors.get("b")!.find((n) => n.recipeId === "a")!.similarity;
    expect(scores[0]).toEqual({ recipeId: "b", score: expect.closeTo(simAB * r, 12), because: "a" });
    expect(scores.find((entry) => entry.recipeId === "z")).toEqual({ recipeId: "z", score: 0, because: null });
  });

  it("handles a new user (no ratings) and a new recipe (nobody interacted) without errors", () => {
    expect(interactedCount(model, "moi")).toBe(0);
    expect(collaborativeScores(model, "moi", ["a", "b"]).every((entry) => entry.score === 0)).toBe(true);
    expect(collaborativeScores(model, "v", ["mon-moi"])).toEqual([{ recipeId: "mon-moi", score: 0, because: null }]);
    expect(alsoCooked(model, "mon-moi", "v")).toEqual([]);
    expect(interactedCount(model, "v")).toBe(1);
  });
});

describe("\"Người khác cũng nấu\" (aggregate only)", () => {
  it(`needs at least ${MIN_SUPPORT} other users who interacted with both recipes`, () => {
    const two = buildCollaborativeModel(everyone(["u1", "u2"], ["a", "b"]), now);
    const three = buildCollaborativeModel(everyone(["u1", "u2", "u3"], ["a", "b"]), now);
    expect(alsoCooked(two, "a", null)).toEqual([]);
    expect(alsoCooked(three, "a", null).map((entry) => entry.recipeId)).toEqual(["b"]);
  });

  it("does not count the viewer: 3 users including the viewer is not enough", () => {
    const model = buildCollaborativeModel(everyone(["u1", "u2", "v"], ["a", "b"]), now);
    expect(alsoCooked(model, "a", "v")).toEqual([]);
    expect(alsoCooked(model, "a", "khac")).toHaveLength(1);
  });

  it("returns only recipe ids and similarity, never users or counts", () => {
    const model = buildCollaborativeModel(everyone(["u1", "u2", "u3", "u4"], ["a", "b", "c"]), now);
    const result = alsoCooked(model, "a", null);
    expect(result.length).toBe(2);
    for (const entry of result) expect(Object.keys(entry).sort()).toEqual(["recipeId", "similarity"]);
    expect(JSON.stringify(result)).not.toMatch(/u1|u2|u3|u4|support/);
  });

  it("can be restricted to safe candidates", () => {
    const model = buildCollaborativeModel(everyone(["u1", "u2", "u3"], ["a", "b", "c"]), now);
    expect(alsoCooked(model, "a", null, 6, new Set(["c"])).map((entry) => entry.recipeId)).toEqual(["c"]);
  });
});

describe("Loading interactions from existing tables", () => {
  it("aggregates eaten meals, posts with a recipe and likes on others' posts with GROUP BY; no \"planned\" for CF", async () => {
    mocks.queryRaw.mockResolvedValue([{ userId: "u", recipeId: "a", kind: "EATEN", at: now, count: 2n }]);
    expect(await loadCollaborativeInteractions()).toEqual([{ userId: "u", recipeId: "a", kind: "EATEN", at: now, count: 2 }]);
    const sql = mocks.queryRaw.mock.calls[0][0].sql as string;
    expect(sql).toContain('mi."completed" = true');
    expect(sql).toContain('p."recipeId" IS NOT NULL');
    expect(sql).toContain('l."userId" <> p."authorId"');
    expect(sql.match(/GROUP BY/g)).toHaveLength(3);
    expect(sql).not.toContain("PLANNED");
  });

  it("loads one user's history for content-based scoring, including planned meals of non-draft plans", async () => {
    mocks.queryRaw.mockResolvedValue([]);
    await loadUserInteractions("user-a");
    const query = mocks.queryRaw.mock.calls[0][0];
    expect(query.sql).toContain("PLANNED");
    expect(query.sql).toContain(`mp."status" <> 'DRAFT'`);
    expect(query.values.every((value: unknown) => value === "user-a")).toBe(true);
    expect(query.values).toHaveLength(4);
  });
});

describe("Collaborative model cache", () => {
  afterEach(async () => (await import("./recommendation.service.js")).clearRecommendationCache());

  it("reuses the model for 10 minutes, then rebuilds", async () => {
    const { COLLABORATIVE_CACHE_MS, getCollaborativeModel } = await import("./recommendation.service.js");
    mocks.queryRaw.mockResolvedValue([]);
    const first = await getCollaborativeModel(now);
    expect(await getCollaborativeModel(new Date(now.getTime() + COLLABORATIVE_CACHE_MS - 1))).toBe(first);
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
    await getCollaborativeModel(new Date(now.getTime() + COLLABORATIVE_CACHE_MS));
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("Performance (generated in memory)", () => {
  it("builds 500 recipes × 1000 users × 20 interactions quickly and predicts in milliseconds", () => {
    let seed = 42;
    const random = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    const interactions: Interaction[] = [];
    for (let user = 0; user < 1000; user++) {
      for (let n = 0; n < 20; n++) interactions.push(ate(`u${user}`, `r${Math.floor(random() * 500)}`, Math.floor(random() * 60)));
    }
    const started = performance.now();
    const model = buildCollaborativeModel(interactions, now);
    const built = performance.now() - started;
    const candidates = Array.from({ length: 500 }, (_, index) => `r${index}`);
    const predictStart = performance.now();
    const scores = collaborativeScores(model, "u1", candidates);
    const predicted = performance.now() - predictStart;
    expect(scores.length).toBeGreaterThan(400);
    expect(built).toBeLessThan(3000);
    expect(predicted).toBeLessThan(100);
  });
});
