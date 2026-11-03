import { describe, expect, it } from "vitest";
import { buildCollaborativeModel, collaborativeScores } from "./collaborative.js";
import type { Interaction } from "./interactions.js";

// Đo thời gian thuật toán 2 (chạy riêng: npm run test:perf -w backend).
const day = 86_400_000;
const now = new Date("2026-11-03T03:00:00.000Z");
const ate = (userId: string, recipeId: string, daysAgo = 0): Interaction => ({
  userId, recipeId, kind: "EATEN", at: new Date(now.getTime() - daysAgo * day), count: 1,
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
