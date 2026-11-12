import { describe, expect, it, vi } from "vitest";
import { recipeFit } from "../src/modules/recommendation/safety.js";
import { seedRecipesAsRecords } from "../src/test/seed-recipes.js";
import { demoProfile } from "./demo-account.js";
import { createDemoHistory, DEMO_HISTORY_MEALS, DEMO_LIKED_RECIPES } from "./demo-history.js";

const DAY = 86_400_000;
// 18:30 UTC ngày 2/11 = 01:30 sáng 3/11 giờ Việt Nam.
const now = new Date("2026-11-02T18:30:00.000Z");
const recipes = seedRecipesAsRecords();
const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));

describe("Demo sample history (about 2 weeks, relative to the run date)", () => {
  it("has 8–12 eaten meals (at least 10 different dishes, so the demo is not a cold start) of one consistent taste that are safe for the demo profile and fit their meal type", () => {
    expect(DEMO_HISTORY_MEALS.length).toBeGreaterThanOrEqual(8);
    expect(DEMO_HISTORY_MEALS.length).toBeLessThanOrEqual(12);
    expect(new Set(DEMO_HISTORY_MEALS.map((meal) => meal.slug)).size).toBeGreaterThanOrEqual(10);
    for (const meal of DEMO_HISTORY_MEALS) {
      const recipe = bySlug.get(meal.slug)!;
      expect(recipe, meal.slug).toBeDefined();
      expect(recipeFit(recipe, demoProfile).safe, meal.slug).toBe(true);
      expect(recipe.mealTypes, meal.slug).toContain(meal.mealType);
    }
    const cuisines = new Set(DEMO_HISTORY_MEALS.map((meal) => bySlug.get(meal.slug)!.cuisine));
    expect([...cuisines].every((cuisine) => demoProfile.preferredCuisines.includes(cuisine))).toBe(true);
    expect(DEMO_HISTORY_MEALS.filter((meal) => meal.slug.startsWith("ca-") || meal.slug.includes("-ca-")).length).toBeGreaterThanOrEqual(3);
  });

  it("creates one completed plan dated from today in Vietnam, all meals eaten, without pantry history", async () => {
    const client = {
      recipe: { findMany: vi.fn(async (_args?: unknown) => recipes.map(({ id, slug, calories }) => ({ id, slug, calories }))) },
      mealPlan: { create: vi.fn(async (_args: { data: any }) => ({})) },
      communityPost: { findMany: vi.fn(async (_args: { where: object }) => [
        { id: "p-other", recipe: { slug: "bo-xao-bong-cai" } }, { id: "p-fish", recipe: { slug: "ca-hap-gung-hanh" } },
        { id: "p-teri", recipe: { slug: "ga-teriyaki" } }, { id: "p-ga", recipe: { slug: "ga-xao-sa-ot" } },
      ]) },
      communityLike: { createMany: vi.fn(async (_args: { data: Array<{ postId: string }> }) => ({ count: 0 })) },
    };
    const result = await createDemoHistory(client as never, "demo-id", now);
    expect(result).toEqual({ meals: DEMO_HISTORY_MEALS.length, likes: 3 });
    const plan = client.mealPlan.create.mock.calls[0][0].data;
    expect(plan).toMatchObject({ userId: "demo-id", status: "COMPLETED" });
    const today = Date.UTC(2026, 10, 3);
    expect((plan.startDate.getTime() - today) / DAY).toBe(-13);
    expect((plan.endDate.getTime() - today) / DAY).toBe(-7);
    const items = plan.days.create.flatMap((day: { items: { create: Array<{ completed: boolean }> } }) => day.items.create);
    expect(items).toHaveLength(DEMO_HISTORY_MEALS.length);
    expect(items.every((item: { completed: boolean }) => item.completed)).toBe(true);
    expect(client).not.toHaveProperty("pantryTransaction");
    // Chỉ thích bài của tài khoản mẫu, theo thứ tự món ưu tiên.
    expect(client.communityPost.findMany.mock.calls[0][0].where).toMatchObject({ author: { isSample: true }, recipe: { slug: { in: DEMO_LIKED_RECIPES } } });
    expect(client.communityLike.createMany.mock.calls[0][0].data.map((like: { postId: string }) => like.postId)).toEqual(["p-fish", "p-teri", "p-ga"]);
  });

  it("demo:reset khi có món đã xóa mềm: chỉ lấy món còn dùng, bữa của món đã xóa thì bỏ qua (không lỗi)", async () => {
    const [deleted, ...kept] = [...new Set(DEMO_HISTORY_MEALS.map((meal) => meal.slug))];
    const client = {
      recipe: { findMany: vi.fn(async (_args: { where: object }) => recipes.filter((recipe) => recipe.slug !== deleted).map(({ id, slug, calories }) => ({ id, slug, calories }))) },
      mealPlan: { create: vi.fn(async (_args: { data: any }) => ({})) },
      communityPost: { findMany: vi.fn(async () => []) },
      communityLike: { createMany: vi.fn(async () => ({ count: 0 })) },
    };
    const result = await createDemoHistory(client as never, "demo-id", now);
    expect(client.recipe.findMany.mock.calls[0][0].where).toMatchObject({ hiddenAt: null, deletedAt: null });
    expect(result.meals).toBe(DEMO_HISTORY_MEALS.filter((meal) => meal.slug !== deleted).length);
    expect(kept.length).toBeGreaterThan(0);
  });
});
