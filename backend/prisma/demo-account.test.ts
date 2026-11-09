import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmReset, DEMO_EMAIL, demoPantryItems, demoPantryTemplate, resetDemoAccount, seedDemoAccount, vietnamToday,
} from "./demo-account.js";

const DAY = 86_400_000;
// 18:30 UTC ngày 2/11 = 01:30 sáng 3/11 giờ Việt Nam.
const now = new Date("2026-11-02T18:30:00.000Z");
const daysFromToday = (date: Date | string | null | undefined) => Math.round((new Date(date!).getTime() - Date.UTC(2026, 10, 3)) / DAY);

describe("Demo pantry with expiry dates relative to the run date (Vietnam time)", () => {
  it("uses today's date in Vietnam, not UTC", () => {
    expect(vietnamToday(now)).toEqual(new Date("2026-11-03T00:00:00.000Z"));
    expect(vietnamToday(new Date("2026-11-03T16:59:00.000Z"))).toEqual(new Date("2026-11-03T00:00:00.000Z"));
  });

  it("always has something expiring within 1–2 days, items lasting 5–10 days, and one item under its minimum stock", () => {
    const items = demoPantryItems("demo-id", now);
    const offsets = items.map((item) => daysFromToday(item.expiryDate));
    expect(items.every((item) => item.userId === "demo-id")).toBe(true);
    expect(offsets.filter((offset) => offset >= 1 && offset <= 2).length).toBeGreaterThanOrEqual(1);
    expect(offsets.filter((offset) => offset >= 5 && offset <= 10).length).toBeGreaterThanOrEqual(4);
    expect(items.filter((item) => (item.minimumStock ?? 0) > 0 && item.quantity <= (item.minimumStock ?? 0))).toHaveLength(1);
    expect(items.every((item) => item.quantity > 0)).toBe(true);
  });

  it("moves with the run date: running a week later gives the same relative dates", () => {
    const later = demoPantryItems("demo-id", new Date(now.getTime() + 7 * DAY));
    expect(later.map((item) => daysFromToday(item.expiryDate) - 7)).toEqual(demoPantryItems("demo-id", now).map((item) => daysFromToday(item.expiryDate)));
  });

  it("names pantry items like the seed recipe ingredients so suggestions and deduction match", () => {
    expect(demoPantryTemplate.map((item) => item.name)).toEqual(["Đậu hũ", "Ức gà", "Bông cải xanh", "Hành tím", "Khoai lang", "Gừng", "Trứng", "Gạo"]);
  });
});

describe("seedDemoAccount", () => {
  const client = {
    user: { upsert: vi.fn() },
    nutritionProfile: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    pantryItem: { count: vi.fn(), createMany: vi.fn() },
    mealPlan: { count: vi.fn(), create: vi.fn() },
    recipe: { findMany: vi.fn(async () => []) },
    communityPost: { findMany: vi.fn(async () => []) },
    communityLike: { createMany: vi.fn() },
  };
  beforeEach(() => {
    vi.resetAllMocks();
    client.user.upsert.mockResolvedValue({ id: "demo-id" });
    client.nutritionProfile.findUnique.mockResolvedValue({ age: 30, gender: "MALE", heightCm: 175, weightKg: 70, activityLevel: "HIGH", goal: "LOSE_WEIGHT", dietType: "VEGAN" });
  });

  it("only targets the demo email and never overwrites an existing demo profile or pantry", async () => {
    client.pantryItem.count.mockResolvedValue(3);
    const result = await seedDemoAccount(client as never, now);
    expect(client.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { email: DEMO_EMAIL }, update: {} }));
    expect(client.nutritionProfile.update.mock.calls[0][0].data).not.toHaveProperty("dietType");
    expect(client.pantryItem.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ userId: "demo-id", pantryCreated: false, historyCreated: false });
    expect(client.mealPlan.create).not.toHaveBeenCalled();
  });

  it("creates the sample pantry when the demo pantry is empty", async () => {
    client.pantryItem.count.mockResolvedValue(0);
    await seedDemoAccount(client as never, now);
    expect(client.pantryItem.createMany.mock.calls[0][0].data).toHaveLength(demoPantryTemplate.length);
  });
});

describe("resetDemoAccount", () => {
  const tx = {
    user: { create: vi.fn(), update: vi.fn() },
    communityPost: { findMany: vi.fn(), deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    chatMessage: { deleteMany: vi.fn() },
    pantryTransaction: { deleteMany: vi.fn() },
    receiptScan: { deleteMany: vi.fn() },
    mealPlan: { deleteMany: vi.fn() },
    communityLike: { deleteMany: vi.fn() },
    communityComment: { deleteMany: vi.fn() },
    pantryItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    nutritionProfile: { upsert: vi.fn() },
  };
  const client = { user: { findUnique: vi.fn() }, $transaction: vi.fn(async (operation: (db: typeof tx) => unknown) => operation(tx)) };
  const samples = { hashes: vi.fn(async () => ["h1"]), rebuild: vi.fn(async () => ({ accounts: 8, posts: 8, likes: 20 })) };
  const history = vi.fn(async () => ({ meals: 10, likes: 3 }));
  const reset = () => resetDemoAccount(client as never, now, samples as never, history as never);
  beforeEach(() => {
    for (const model of Object.values(tx)) for (const fn of Object.values(model)) fn.mockReset().mockResolvedValue({ count: 2 });
    client.user.findUnique.mockReset().mockResolvedValue({ id: "demo-id" });
    tx.communityPost.findMany.mockResolvedValue([{ id: "post-1", images: [{ publicId: "nouri/posts/a" }] }, { id: "post-2", images: [] }]);
    tx.pantryItem.createMany.mockResolvedValue({ count: demoPantryTemplate.length });
  });

  it("deletes only the demo user's data, in one transaction", async () => {
    const result = await reset();
    expect(client.user.findUnique).toHaveBeenCalledWith({ where: { email: DEMO_EMAIL }, select: { id: true } });
    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(tx.notification.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ userId: "demo-id" }, { relatedId: { in: ["post-1", "post-2"] } }] } });
    for (const [model, where] of [
      [tx.chatMessage, { userId: "demo-id" }], [tx.pantryTransaction, { userId: "demo-id" }], [tx.mealPlan, { userId: "demo-id" }],
      [tx.communityLike, { userId: "demo-id" }], [tx.communityComment, { authorId: "demo-id" }], [tx.communityPost, { authorId: "demo-id" }],
      [tx.pantryItem, { userId: "demo-id" }], [tx.receiptScan, { userId: "demo-id" }],
    ] as const) expect(model.deleteMany).toHaveBeenCalledWith({ where });
    expect(result.imagePublicIds).toEqual(["nouri/posts/a"]);
  });

  it("rebuilds the sample accounts in the same transaction, with password hashes made before it", async () => {
    const result = await reset();
    expect(samples.rebuild).toHaveBeenCalledWith(tx, ["h1"], now);
    expect(samples.hashes.mock.invocationCallOrder[0]).toBeLessThan(client.$transaction.mock.invocationCallOrder.at(-1)!);
    expect(result.sampleAccounts).toEqual({ accounts: 8, posts: 8, likes: 20 });
  });

  it("recreates the demo's sample history after the sample accounts, in the same transaction", async () => {
    const result = await reset();
    expect(history).toHaveBeenCalledWith(tx, "demo-id", now);
    expect(samples.rebuild.mock.invocationCallOrder.at(-1)!).toBeLessThan(history.mock.invocationCallOrder.at(-1)!);
    expect(tx.mealPlan.deleteMany.mock.invocationCallOrder.at(-1)!).toBeLessThan(history.mock.invocationCallOrder.at(-1)!);
    expect(result.demoHistory).toEqual({ meals: 10, likes: 3 });
  });

  it("recreates the sample profile and pantry, unlocks the account and resets name/password", async () => {
    await reset();
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "demo-id" }, data: expect.objectContaining({ name: "Minh Anh", lockedAt: null, role: "USER" }) });
    expect(tx.nutritionProfile.upsert.mock.calls[0][0].update).toMatchObject({ dietType: "BALANCED", allergies: [], dislikedFoods: ["Cần tây"] });
    const data = tx.pantryItem.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(demoPantryTemplate.length);
    expect(data[0]).toMatchObject({ userId: "demo-id", name: "Đậu hũ", expiryDate: new Date("2026-11-04T00:00:00.000Z") });
    expect(tx.pantryItem.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(tx.pantryItem.createMany.mock.invocationCallOrder[0]);
  });

  it("creates the demo account when it does not exist yet", async () => {
    client.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: "new-demo" });
    const result = await reset();
    expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: DEMO_EMAIL }) });
    expect(result.userId).toBe("new-demo");
  });
});

describe("confirmReset", () => {
  it("runs with --yes or -y without asking", async () => {
    const ask = vi.fn();
    expect(await confirmReset(["--yes"], false, ask)).toBe(true);
    expect(await confirmReset(["-y"], true, ask)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it("refuses without --yes when there is no terminal to ask", async () => {
    expect(await confirmReset([], false, vi.fn())).toBe(false);
  });

  it("asks interactively and only accepts the exact phrase", async () => {
    expect(await confirmReset([], true, async () => " Dat lai ")).toBe(true);
    expect(await confirmReset([], true, async () => "yes")).toBe(false);
  });
});
