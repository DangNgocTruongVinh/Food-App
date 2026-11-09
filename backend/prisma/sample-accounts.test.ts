import { describe, expect, it, vi } from "vitest";
import { alsoCooked, buildCollaborativeModel } from "../src/modules/recommendation/collaborative.js";
import { recipeFit } from "../src/modules/recommendation/safety.js";
import { seedRecipesAsRecords } from "../src/test/seed-recipes.js";
import { rebuildSampleAccounts, SAMPLE_EMAIL, sampleMembers, samplePasswordHashes, seedSampleAccounts } from "./sample-accounts.js";

const now = new Date("2026-11-03T03:00:00.000Z");
const recipes = seedRecipesAsRecords();
const bySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe]));

describe("Sample accounts (illustration data for collaborative filtering)", () => {
  const members = sampleMembers();

  it("has 8 members mau1–mau8 in 3 taste groups", () => {
    expect(members.map((member) => SAMPLE_EMAIL(member.index))).toEqual(Array.from({ length: 8 }, (_, i) => `mau${i + 1}@nouri.vn`));
    expect(new Set(members.map((member) => member.group.name)).size).toBe(3);
  });

  it("only eats seed recipes that are safe for the member's own profile (diet, allergies)", () => {
    for (const member of members) {
      for (const slug of member.recipes) {
        const recipe = bySlug.get(slug);
        expect(recipe, slug).toBeDefined();
        const profile = { dietType: member.group.profile.dietType, allergies: member.group.profile.allergies ?? [], dislikedFoods: [] };
        expect(recipeFit(recipe!, profile).safe, `${SAMPLE_EMAIL(member.index)} → ${slug}`).toBe(true);
      }
    }
  });

  it("gives collaborative filtering pairs with at least 3 users, so \"Người khác cũng nấu\" can show in the demo", () => {
    const interactions = members.flatMap((member) => member.recipes.map((slug) => ({
      userId: `mau${member.index}`, recipeId: slug, kind: "EATEN" as const, at: now, count: 1,
    })));
    const model = buildCollaborativeModel(interactions, now);
    for (const slug of ["bun-xao-chay", "ga-xao-sa-ot", "ga-teriyaki"]) expect(alsoCooked(model, slug, "demo").length, slug).toBeGreaterThan(0);
  });

  it("makes distinct random password hashes (never a fixed password)", async () => {
    const hashes = await samplePasswordHashes(3);
    expect(new Set(hashes).size).toBe(3);
    for (const hash of hashes) expect(hash).toMatch(/^\$2[aby]\$10\$/);
  }, 20_000);
});

describe("rebuildSampleAccounts", () => {
  const makeTx = () => {
    let users = 0;
    let posts = 0;
    return {
      communityPost: {
        findMany: vi.fn(async () => [{ id: "old-post" }]),
        create: vi.fn(async ({ data }) => ({ id: `post-${++posts}`, ...data })),
      },
      notification: { deleteMany: vi.fn() },
      user: { deleteMany: vi.fn(), create: vi.fn(async ({ data }) => ({ id: `user-${++users}`, ...data })) },
      recipe: { findMany: vi.fn(async (_args: { where: object }) => recipes.map(({ id, slug, mealTypes, calories }) => ({ id, slug, mealTypes, calories }))) },
      mealPlan: { create: vi.fn() },
      communityLike: { createMany: vi.fn(async (_args: { data: Array<{ postId: string; userId: string }> }) => ({ count: 0 })) },
    };
  };

  it("deletes old sample users (and notifications about their posts), then recreates flagged accounts with given hashes", async () => {
    const tx = makeTx();
    const hashes = Array.from({ length: 8 }, (_, i) => `hash-${i + 1}`);
    const result = await rebuildSampleAccounts(tx as never, hashes, now);
    expect(tx.notification.deleteMany).toHaveBeenCalledWith({ where: { relatedId: { in: ["old-post"] } } });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { isSample: true } });
    expect(tx.user.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(tx.user.create.mock.invocationCallOrder[0]);
    const created = tx.user.create.mock.calls.map(([args]) => args.data);
    expect(created.map((data) => [data.email, data.name, data.isSample, data.passwordHash])).toEqual(
      Array.from({ length: 8 }, (_, i) => [`mau${i + 1}@nouri.vn`, `Người dùng mẫu ${i + 1}`, true, `hash-${i + 1}`]),
    );
    expect(tx.recipe.findMany.mock.calls[0][0].where).toMatchObject({ hiddenAt: null });
    expect(result).toEqual({ accounts: 8, posts: 8, likes: 3 * 2 + 3 * 2 + 2 * 1 });
  });

  it("creates a completed plan of eaten meals per member and likes only within the same group, never one's own post", async () => {
    const tx = makeTx();
    await rebuildSampleAccounts(tx as never, Array(8).fill("h"), now);
    const members = sampleMembers();
    tx.mealPlan.create.mock.calls.forEach(([args], index) => {
      expect(args.data.status).toBe("COMPLETED");
      expect(args.data.days.create).toHaveLength(7);
      const items = args.data.days.create.flatMap((day: { items: { create: Array<{ completed: boolean }> } }) => day.items.create);
      expect(items.length).toBe(members[index].recipes.length);
      expect(items.every((item: { completed: boolean }) => item.completed)).toBe(true);
    });
    const groupOfUser = (id: string) => members[Number(id.split("-")[1]) - 1].group.name;
    const authorOfPost = new Map(tx.communityPost.create.mock.results.map((result, i) => [`post-${i + 1}`, `user-${i + 1}`]));
    const [[{ data: likes }]] = tx.communityLike.createMany.mock.calls as unknown as Array<[{ data: Array<{ postId: string; userId: string }> }]>;
    for (const like of likes) {
      const author = authorOfPost.get(like.postId)!;
      expect(author).not.toBe(like.userId);
      expect(groupOfUser(author)).toBe(groupOfUser(like.userId));
    }
  });

  it("seed only creates sample accounts when some are missing", async () => {
    const client = { user: { count: vi.fn(async () => 8) }, $transaction: vi.fn() };
    expect(await seedSampleAccounts(client as never, now)).toBeNull();
    expect(client.$transaction).not.toHaveBeenCalled();
  });
});
