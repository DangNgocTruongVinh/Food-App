import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedRecipes } from "./seed-data.js";
import { seedAdminAccount, seedRecipeCatalog } from "./seed-steps.js";

const client = {
  recipe: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
};
const seedClient = client as unknown as Parameters<typeof seedRecipeCatalog>[0];
const [first, second] = seedRecipes;

beforeEach(() => vi.resetAllMocks());

describe("seedRecipeCatalog", () => {
  it("only creates missing seed recipes and never deletes or overwrites existing ones by default", async () => {
    client.recipe.findUnique.mockImplementation(async ({ where }) => (where.slug === first.slug ? { id: "existing" } : null));
    const result = await seedRecipeCatalog(seedClient, [first, second], false);
    expect(result).toEqual({ created: 1, updated: 0, skipped: 1 });
    expect(client.recipe.create).toHaveBeenCalledOnce();
    expect(client.recipe.create.mock.calls[0][0].data).toMatchObject({ slug: second.slug, servings: 1 });
    expect(client.recipe.update).not.toHaveBeenCalled();
    expect(client.recipe.deleteMany).not.toHaveBeenCalled();
    expect(client.recipe.upsert).not.toHaveBeenCalled();
  });

  it("updates existing seed recipes only when SEED_UPDATE_RECIPES is on", async () => {
    client.recipe.findUnique.mockResolvedValue({ id: "existing" });
    const result = await seedRecipeCatalog(seedClient, [first], true);
    expect(result).toEqual({ created: 0, updated: 1, skipped: 0 });
    expect(client.recipe.update).toHaveBeenCalledWith({
      where: { slug: first.slug },
      data: expect.objectContaining({ name: first.name, ingredients: { deleteMany: {}, create: first.ingredients } }),
    });
    expect(client.recipe.deleteMany).not.toHaveBeenCalled();
  });
});

describe("seedAdminAccount", () => {
  const admin = { email: "admin@nouri.vn", password: "Mat-khau-dai-1" };

  it("creates the Admin account with a bcrypt hash, never the plain password", async () => {
    client.user.findUnique.mockResolvedValue(null);
    expect(await seedAdminAccount(seedClient, admin)).toBe("created");
    const { data } = client.user.create.mock.calls[0][0];
    expect(data).toMatchObject({ email: admin.email, role: "ADMIN", profile: { create: {} } });
    expect(JSON.stringify(data)).not.toContain(admin.password);
    expect(await bcrypt.compare(admin.password, data.passwordHash)).toBe(true);
  });

  it("promotes (and unlocks) an existing account without changing its password", async () => {
    client.user.findUnique.mockResolvedValue({ id: "user-a" });
    expect(await seedAdminAccount(seedClient, admin)).toBe("promoted");
    expect(client.user.update).toHaveBeenCalledWith({ where: { email: admin.email }, data: { role: "ADMIN", lockedAt: null } });
    expect(client.user.create).not.toHaveBeenCalled();
  });
});
