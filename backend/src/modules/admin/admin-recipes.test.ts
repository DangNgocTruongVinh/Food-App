import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { getAccountStatus } from "../../services/account-status.service.js";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import adminRoutes from "./admin.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  count: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  recipe: {
    count: mocks.count, findMany: mocks.findMany, findUnique: mocks.findUnique,
    create: mocks.create, update: mocks.update, delete: mocks.remove,
  },
  adminAuditLog: { create: mocks.auditCreate },
  $transaction: mocks.transaction,
} }));

const app = testApp("/api/admin", adminRoutes);
const adminId = "cm11111111111111111111111";
const recipeId = "cm22222222222222222222222";
const token = () => `Bearer ${jwt.sign({ sub: adminId, email: "admin@nouri.vn" }, mocks.secret)}`;
const accountStatus = vi.mocked(getAccountStatus);
const asAdmin = () => accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: null });

const input = {
  name: "Đậu hũ sốt nấm",
  description: "Đậu hũ chiên sốt nấm đông cô.",
  instructions: ["Chiên đậu hũ", "Xào nấm", "Rưới sốt"],
  prepMinutes: 10,
  cookMinutes: 15,
  calories: 420,
  proteinG: 22,
  carbsG: 30,
  fatG: 18,
  cuisine: "Việt Nam",
  dietTags: ["VEGAN"],
  mealTypes: ["LUNCH", "DINNER"],
  ingredients: [
    { name: "Đậu hũ", quantity: 200, unit: "G" },
    { name: "Nấm đông cô", quantity: 50, unit: "G" },
    { name: "Nước tương", quantity: 15, unit: "ML" },
  ],
};
const stored = {
  id: recipeId, slug: "dau-hu-sot-nam", ...input, dietTags: ["VEGAN", "VEGETARIAN"], servings: 1, fiberG: 0, imageUrl: null, hiddenAt: null,
  ingredients: input.ingredients.map((ingredient, index) => ({ id: `i${index}`, recipeId, optional: false, ...ingredient })),
  createdAt: new Date("2026-10-31T00:00:00.000Z"), updatedAt: new Date("2026-10-31T00:00:00.000Z"),
};
const unused = { _count: { mealItems: 0, communityPosts: 0 } };
const tx = fakeTransaction(() => prisma);
const auditData = (index = 0) => mocks.auditCreate.mock.calls[index][0].data;
const loggedInTransaction = (index = 0) => tx.wasCalledInTransaction(mocks.transaction, mocks.auditCreate, index);

beforeEach(() => {
  vi.resetAllMocks();
  asAdmin();
  mocks.count.mockResolvedValue(1);
  mocks.findMany.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue({ ...stored, ...unused });
  mocks.create.mockResolvedValue(stored);
  mocks.update.mockResolvedValue(stored);
  mocks.remove.mockResolvedValue(stored);
  mocks.transaction.mockImplementation(tx.run);
  mocks.auditCreate.mockResolvedValue({ id: "log" });
});

const endpoints = [
  ["GET", "/api/admin/recipes", undefined, 200],
  ["GET", `/api/admin/recipes/${recipeId}`, undefined, 200],
  ["POST", "/api/admin/recipes", input, 201],
  ["PUT", `/api/admin/recipes/${recipeId}`, input, 200],
  ["PATCH", `/api/admin/recipes/${recipeId}/visibility`, { hidden: true }, 200],
  ["DELETE", `/api/admin/recipes/${recipeId}`, undefined, 204],
] as const;

describe("Admin recipe API permission matrix", () => {
  const touchedDatabase = () => [
    mocks.count, mocks.findMany, mocks.findUnique, mocks.create, mocks.update, mocks.remove, mocks.auditCreate, mocks.transaction,
  ].some((mock) => mock.mock.calls.length > 0);

  it.each(endpoints)("%s %s → 401 without login", async (method, path, body) => {
    expect((await request(app, path, { method, body })).status).toBe(401);
    expect(touchedDatabase()).toBe(false);
  });

  it.each(endpoints)("%s %s → 403 for a USER account", async (method, path, body) => {
    accountStatus.mockResolvedValue({ role: "USER", lockedAt: null });
    expect(await request(app, path, { method, body, token: token() }))
      .toEqual({ status: 403, body: { message: "Bạn không có quyền thực hiện thao tác này." } });
    expect(touchedDatabase()).toBe(false);
  });

  it.each(endpoints)("%s %s → 403 ACCOUNT_LOCKED for a locked admin", async (method, path, body) => {
    accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: new Date() });
    const response = await request(app, path, { method, body, token: token() });
    expect(response.status).toBe(403);
    expect(response.body.details).toEqual({ code: "ACCOUNT_LOCKED" });
    expect(touchedDatabase()).toBe(false);
  });

  it.each(endpoints)("%s %s → %s for an ADMIN account", async (method, path, body, status) => {
    expect((await request(app, path, { method, body, token: token() })).status).toBe(status);
  });
});

describe("Admin recipe management", () => {
  it("lists with search, status filter, pagination and usage counts", async () => {
    mocks.count.mockResolvedValue(41);
    mocks.findMany.mockResolvedValue([{ ...stored, hiddenAt: new Date("2026-10-31T00:00:00.000Z"), _count: { mealItems: 3, communityPosts: 1 } }]);
    const response = await request(app, `/api/admin/recipes?search=${encodeURIComponent("đậu")}&status=hidden&page=3&pageSize=20`, { token: token() });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 41, page: 3, pageSize: 20 });
    expect(response.body.items[0]).toMatchObject({ id: recipeId, hidden: true, usage: { mealPlanItems: 3, posts: 1 } });
    expect(response.body.items[0]).not.toHaveProperty("_count");
    const where = { name: { contains: "đậu", mode: "insensitive" }, hiddenAt: { not: null } };
    expect(mocks.count).toHaveBeenCalledWith({ where });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 40, take: 20, orderBy: { name: "asc" } }));
  });

  it("uses defaults (all recipes, page 1, 20 per page) and rejects a page size over 50", async () => {
    await request(app, "/api/admin/recipes", { token: token() });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, skip: 0, take: 20 }));
    expect((await request(app, "/api/admin/recipes?pageSize=51", { token: token() })).status).toBe(422);
  });

  it("creates a recipe: Vietnamese slug, VEGAN adds VEGETARIAN, ingredients created with it", async () => {
    const response = await request(app, "/api/admin/recipes", { method: "POST", token: token(), body: input });
    expect(response.status).toBe(201);
    const { data } = mocks.create.mock.calls[0][0];
    expect(data).toMatchObject({ slug: "dau-hu-sot-nam", dietTags: ["VEGAN", "VEGETARIAN"], mealTypes: ["LUNCH", "DINNER"], servings: 1, fiberG: 0 });
    expect(data.ingredients.create).toEqual(input.ingredients.map((ingredient) => ({ ...ingredient, optional: false })));
  });

  it("adds a numeric suffix when the slug is already taken", async () => {
    mocks.findMany.mockResolvedValue([{ slug: "dau-hu-sot-nam" }, { slug: "dau-hu-sot-nam-2" }]);
    await request(app, "/api/admin/recipes", { method: "POST", token: token(), body: input });
    expect(mocks.findMany).toHaveBeenCalledWith({ where: { slug: { startsWith: "dau-hu-sot-nam" } }, select: { slug: true } });
    expect(mocks.create.mock.calls[0][0].data.slug).toBe("dau-hu-sot-nam-3");
  });

  it("returns 409 when another recipe takes the same slug at the same moment", async () => {
    mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }));
    expect((await request(app, "/api/admin/recipes", { method: "POST", token: token(), body: input })).status).toBe(409);
  });

  it("rejects a vegetarian label that contradicts the ingredients with 422 and the offending ingredients", async () => {
    const body = { ...input, dietTags: ["VEGETARIAN"], ingredients: [...input.ingredients, { name: "Nước mắm", quantity: 10, unit: "ML" }] };
    const response = await request(app, "/api/admin/recipes", { method: "POST", token: token(), body });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      message: "Nhãn chay/thuần chay không khớp với nguyên liệu.",
      details: { violations: [{ ingredient: "Nước mắm", terms: ["nước mắm", "mắm"], dietTag: "VEGETARIAN" }] },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects eggs in a vegan dish (also on update)", async () => {
    const body = { ...input, ingredients: [...input.ingredients, { name: "Trứng gà", quantity: 1, unit: "ITEM" }] };
    const response = await request(app, `/api/admin/recipes/${recipeId}`, { method: "PUT", token: token(), body });
    expect(response.status).toBe(422);
    expect(response.body.details.violations[0]).toMatchObject({ ingredient: "Trứng gà", dietTag: "VEGAN" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([
    ["an invalid unit", { ...input, ingredients: [{ name: "Đậu hũ", quantity: 1, unit: "CUP" }] }],
    ["no ingredient", { ...input, ingredients: [] }],
    ["no meal type", { ...input, mealTypes: [] }],
    ["negative nutrition", { ...input, proteinG: -1 }],
    ["no instruction", { ...input, instructions: [] }],
    ["too many instructions", { ...input, instructions: Array.from({ length: 21 }, (_, index) => `Bước ${index + 1}`) }],
    ["an ambiguous \"Bơ\"", { ...input, ingredients: [{ name: " bơ ", quantity: 1, unit: "ITEM" }] }],
    ["an unsafe image URL", { ...input, imageUrl: "javascript:alert(1)" }],
  ])("rejects %s with 422 before touching the database", async (_name, body) => {
    expect((await request(app, "/api/admin/recipes", { method: "POST", token: token(), body })).status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("updates fields and replaces ingredients in one nested write, keeping the slug", async () => {
    const response = await request(app, `/api/admin/recipes/${recipeId}`, { method: "PUT", token: token(), body: { ...input, name: "Đậu hũ sốt nấm mới" } });
    expect(response.status).toBe(200);
    const call = mocks.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: recipeId });
    expect(call.data).not.toHaveProperty("slug");
    expect(call.data.name).toBe("Đậu hũ sốt nấm mới");
    expect(call.data.ingredients.deleteMany).toEqual({});
    expect(call.data.ingredients.create).toHaveLength(3);
  });

  it("returns 404 when updating, hiding or deleting a missing recipe", async () => {
    mocks.findUnique.mockResolvedValue(null);
    for (const [method, path, body] of endpoints.slice(1)) {
      if (method === "POST") continue;
      expect((await request(app, path, { method, body, token: token() })).status).toBe(404);
    }
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("hides and shows again, keeping the first hidden time", async () => {
    const firstHidden = new Date("2026-10-01T00:00:00.000Z");
    mocks.findUnique.mockResolvedValue({ id: recipeId, hiddenAt: firstHidden });
    mocks.update.mockImplementation(async ({ data }) => ({ id: recipeId, hiddenAt: data.hiddenAt }));
    const hidden = await request(app, `/api/admin/recipes/${recipeId}/visibility`, { method: "PATCH", token: token(), body: { hidden: true } });
    expect(hidden.body).toEqual({ id: recipeId, hiddenAt: firstHidden.toISOString(), hidden: true });
    const shown = await request(app, `/api/admin/recipes/${recipeId}/visibility`, { method: "PATCH", token: token(), body: { hidden: false } });
    expect(shown.body).toEqual({ id: recipeId, hiddenAt: null, hidden: false });
  });

  it("deletes a recipe that was never used", async () => {
    expect((await request(app, `/api/admin/recipes/${recipeId}`, { method: "DELETE", token: token() })).status).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: recipeId } });
  });

  it.each([
    [{ mealItems: 2, communityPosts: 0 }, { mealPlanItems: 2, posts: 0 }],
    [{ mealItems: 0, communityPosts: 1 }, { mealPlanItems: 0, posts: 1 }],
  ])("refuses to delete a used recipe (%o) with 409 and suggests hiding it", async (count, usage) => {
    mocks.findUnique.mockResolvedValue({ id: recipeId, _count: count });
    const response = await request(app, `/api/admin/recipes/${recipeId}`, { method: "DELETE", token: token() });
    expect(response.status).toBe(409);
    expect(response.body.message).toContain("Hãy ẩn món");
    expect(response.body.details).toEqual({ usage });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("maps a foreign-key race (recipe used meanwhile) to the same 409", async () => {
    mocks.remove.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "test" }));
    expect((await request(app, `/api/admin/recipes/${recipeId}`, { method: "DELETE", token: token() })).status).toBe(409);
  });
});

describe("Admin audit log for recipe actions", () => {
  it("logs RECIPE_CREATE with the recipe name and slug in the same transaction as the insert", async () => {
    expect((await request(app, "/api/admin/recipes", { method: "POST", token: token(), body: input })).status).toBe(201);
    expect(auditData()).toEqual({
      actorId: adminId, action: "RECIPE_CREATE", targetType: "RECIPE", targetId: recipeId, targetLabel: input.name,
      details: { slug: "dau-hu-sot-nam" },
    });
    expect(loggedInTransaction()).toBe(true);
  });

  it("logs RECIPE_UPDATE with only the names of changed fields (no values)", async () => {
    mocks.update.mockResolvedValue({ ...stored, name: "Đậu hũ sốt nấm mới" });
    const body = { ...input, name: "Đậu hũ sốt nấm mới", calories: 450, ingredients: input.ingredients.slice(0, 2) };
    expect((await request(app, `/api/admin/recipes/${recipeId}`, { method: "PUT", token: token(), body })).status).toBe(200);
    expect(auditData()).toEqual({
      actorId: adminId, action: "RECIPE_UPDATE", targetType: "RECIPE", targetId: recipeId, targetLabel: "Đậu hũ sốt nấm mới",
      details: { changedFields: ["name", "calories", "ingredients"] },
    });
    expect(JSON.stringify(auditData())).not.toContain("450");
    expect(loggedInTransaction()).toBe(true);
  });

  it("still logs a save that changed nothing, with an empty field list (diet tags compared regardless of order)", async () => {
    mocks.findUnique.mockResolvedValue({ ...stored, dietTags: ["VEGETARIAN", "VEGAN"], ...unused });
    await request(app, `/api/admin/recipes/${recipeId}`, { method: "PUT", token: token(), body: input });
    expect(auditData().details).toEqual({ changedFields: [] });
  });

  it("logs RECIPE_HIDE / RECIPE_SHOW only when the visibility actually changes", async () => {
    const path = `/api/admin/recipes/${recipeId}/visibility`;
    mocks.update.mockImplementation(async ({ data }) => ({ id: recipeId, hiddenAt: data.hiddenAt }));
    mocks.findUnique.mockResolvedValue({ id: recipeId, name: input.name, hiddenAt: null });
    await request(app, path, { method: "PATCH", token: token(), body: { hidden: true } });
    expect(auditData(0)).toEqual({ actorId: adminId, action: "RECIPE_HIDE", targetType: "RECIPE", targetId: recipeId, targetLabel: input.name });
    expect(loggedInTransaction(0)).toBe(true);

    mocks.findUnique.mockResolvedValue({ id: recipeId, name: input.name, hiddenAt: new Date() });
    await request(app, path, { method: "PATCH", token: token(), body: { hidden: true } });
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);

    await request(app, path, { method: "PATCH", token: token(), body: { hidden: false } });
    expect(auditData(1)).toMatchObject({ action: "RECIPE_SHOW", targetId: recipeId });
  });

  it("logs RECIPE_DELETE in the same transaction as the delete", async () => {
    mocks.findUnique.mockResolvedValue({ id: recipeId, name: input.name, slug: "dau-hu-sot-nam", ...unused });
    expect((await request(app, `/api/admin/recipes/${recipeId}`, { method: "DELETE", token: token() })).status).toBe(204);
    expect(auditData()).toEqual({
      actorId: adminId, action: "RECIPE_DELETE", targetType: "RECIPE", targetId: recipeId, targetLabel: input.name,
      details: { slug: "dau-hu-sot-nam" },
    });
    expect(loggedInTransaction()).toBe(true);
    expect(mocks.transaction.mock.calls[0][0]).toHaveLength(2);
  });

  it("writes no log when the action is rejected (422, 409, 404)", async () => {
    const vegetarianFish = { ...input, dietTags: ["VEGETARIAN"], ingredients: [{ name: "Nước mắm", quantity: 10, unit: "ML" }] };
    expect((await request(app, "/api/admin/recipes", { method: "POST", token: token(), body: vegetarianFish })).status).toBe(422);
    mocks.findUnique.mockResolvedValue({ id: recipeId, name: input.name, slug: "x", _count: { mealItems: 1, communityPosts: 0 } });
    expect((await request(app, `/api/admin/recipes/${recipeId}`, { method: "DELETE", token: token() })).status).toBe(409);
    mocks.findUnique.mockResolvedValue(null);
    expect((await request(app, `/api/admin/recipes/${recipeId}/visibility`, { method: "PATCH", token: token(), body: { hidden: true } })).status).toBe(404);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("fails the whole action when the log cannot be written (the transaction is rolled back)", async () => {
    mocks.auditCreate.mockRejectedValue(new Error("audit insert failed"));
    const response = await request(app, "/api/admin/recipes", { method: "POST", token: token(), body: input });
    expect(response.status).toBe(500);
    expect(mocks.create).toHaveBeenCalled();
    expect(loggedInTransaction()).toBe(true);
  });
});
