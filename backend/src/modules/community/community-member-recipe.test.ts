import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { getAccountStatus } from "../../services/account-status.service.js";
import { fakeTransaction } from "../../test/fake-transaction.js";
import { request, testApp } from "../../test/http-test-utils.js";
import adminRoutes from "../admin/admin.routes.js";
import { memberRecipeAllergens, memberRecipeSchema } from "./community-member-recipe.js";
import communityRoutes from "./community.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findPosts: vi.fn(), findPost: vi.fn(), createPost: vi.fn(), updatePost: vi.fn(), updatePosts: vi.fn(),
  findProfile: vi.fn(), findRecipes: vi.fn(), createRecipe: vi.fn(), auditCreate: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  communityPost: {
    findMany: mocks.findPosts, findUnique: mocks.findPost, create: mocks.createPost, update: mocks.updatePost, updateMany: mocks.updatePosts,
  },
  nutritionProfile: { findUnique: mocks.findProfile },
  recipe: { findMany: mocks.findRecipes, create: mocks.createRecipe },
  adminAuditLog: { create: mocks.auditCreate },
  $transaction: mocks.transaction,
} }));

const community = testApp("/api/community", communityRoutes);
const admin = testApp("/api/admin", adminRoutes);
const userId = "cm11111111111111111111111";
const otherId = "cm33333333333333333333333";
const postId = "cm22222222222222222222222";
const recipeId = "cm55555555555555555555555";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "member@nouri.vn" }, mocks.secret)}`;
const tx = fakeTransaction(() => prisma);

const memberRecipe = {
  name: "Canh chua tôm",
  servings: 2,
  minutes: 30,
  ingredients: [{ name: "Tôm", quantity: "300", unit: "g" }, { name: "Cà chua", quantity: "2", unit: "quả" }],
  steps: ["Nấu nước dùng", "Cho tôm vào"],
};
const createdAt = new Date("2026-11-12T08:00:00.000Z");
const feedRow = (extra: object = {}) => ({
  id: postId, authorId: userId, content: "Món tối nay", recipeId: null, recipe: null, memberRecipe, hiddenAt: null, promotedRecipeId: null,
  promotedRecipe: null, images: [], createdAt, updatedAt: createdAt, author: { id: userId, name: "Minh An", isSample: false },
  likes: [], comments: [], _count: { likes: 0, comments: 0 }, ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAccountStatus).mockResolvedValue({ role: "USER", lockedAt: null });
  mocks.findProfile.mockResolvedValue(null);
  mocks.findPosts.mockResolvedValue([]);
  mocks.createPost.mockResolvedValue(feedRow());
  mocks.updatePost.mockResolvedValue(feedRow());
  mocks.updatePosts.mockResolvedValue({ count: 1 });
  mocks.findRecipes.mockResolvedValue([]);
  mocks.auditCreate.mockResolvedValue({ id: "log" });
  mocks.transaction.mockImplementation(tx.run);
});

describe("member recipe validation (Zod)", () => {
  it("accepts a free-form recipe and trims text; quantity and unit may be empty", () => {
    const parsed = memberRecipeSchema.parse({ ...memberRecipe, name: "  Canh chua tôm ", ingredients: [{ name: "Muối" }] });
    expect(parsed.name).toBe("Canh chua tôm");
    expect(parsed.ingredients).toEqual([{ name: "Muối", quantity: "", unit: "" }]);
  });

  it.each([
    ["a too-short name", { name: "A" }],
    ["zero servings", { servings: 0 }],
    ["more than 30 ingredient lines", { ingredients: Array.from({ length: 31 }, () => ({ name: "Muối" })) }],
    ["more than 20 steps", { steps: Array.from({ length: 21 }, () => "Khuấy") }],
    ["a step over 500 characters", { steps: ["a".repeat(501)] }],
    ["an unknown field", { calories: 500 }],
    ["no ingredient", { ingredients: [] }],
  ])("rejects %s", (_name, change) => {
    expect(memberRecipeSchema.safeParse({ ...memberRecipe, ...change }).success).toBe(false);
  });

  it("warns about the viewer's allergies by keyword, using the recommender's allergy groups", () => {
    expect(memberRecipeAllergens(memberRecipe, ["Hải sản"])).toContain("tôm");
    expect(memberRecipeAllergens(memberRecipe, ["Đậu phộng"])).toEqual([]);
    expect(memberRecipeAllergens(null, ["Hải sản"])).toEqual([]);
  });
});

describe("posting and editing a member recipe", () => {
  it("stores the recipe inside the post (no Recipe row) and accepts it as a JSON string in multipart forms", async () => {
    const response = await request(community, "/api/community", {
      method: "POST", token: token(), body: { content: "", memberRecipe: JSON.stringify(memberRecipe) },
    });
    expect(response.status).toBe(201);
    expect(mocks.createPost.mock.calls[0][0].data).toEqual({ authorId: userId, content: "", recipeId: null, memberRecipe });
    expect(mocks.createRecipe).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({ memberRecipe, memberRecipeAllergens: [], hidden: false });
  });

  it("refuses an existing recipe and a member recipe in the same post", async () => {
    const response = await request(community, "/api/community", {
      method: "POST", token: token(), body: { content: "x", recipeId, memberRecipe },
    });
    expect(response.status).toBe(422);
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("shows allergy warnings for the viewer and hides posts an Admin hid (except to their author)", async () => {
    mocks.findProfile.mockResolvedValue({ allergies: ["Hải sản"] });
    mocks.findPosts.mockResolvedValue([feedRow()]);
    const response = await request(community, "/api/community", { token: token() });
    expect(response.body[0].memberRecipeAllergens).toContain("tôm");
    expect(mocks.findPosts.mock.calls[0][0].where).toEqual({ OR: [{ hiddenAt: null }, { authorId: userId }] });
  });

  it("lets only the author edit; others and missing posts get the same 404", async () => {
    mocks.findPost.mockResolvedValue({ authorId: otherId, recipeId: null, _count: { images: 0 } });
    const body = { content: "Sửa", memberRecipe };
    expect(await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body }))
      .toEqual({ status: 404, body: { message: "Không tìm thấy bài viết." } });
    mocks.findPost.mockResolvedValue(null);
    expect((await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body })).status).toBe(404);
    expect(mocks.updatePost).not.toHaveBeenCalled();
  });

  it("edits the author's post, removes the recipe with null, and keeps the post non-empty", async () => {
    mocks.findPost.mockResolvedValue({ authorId: userId, recipeId: null, _count: { images: 0 } });
    const ok = await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body: { content: "Mới", memberRecipe } });
    expect(ok.status).toBe(200);
    expect(mocks.updatePost.mock.calls[0][0].data).toEqual({ content: "Mới", memberRecipe });
    const empty = await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body: { content: "", memberRecipe: null } });
    expect(empty.status).toBe(422);
    mocks.findPost.mockResolvedValue({ authorId: userId, recipeId, _count: { images: 0 } });
    const mixed = await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body: { content: "x", memberRecipe } });
    expect(mixed.status).toBe(422);
    expect(mocks.updatePost).toHaveBeenCalledTimes(1);
  });
});

describe("Admin: hide a post, turn a member recipe into a library recipe", () => {
  const asAdmin = () => vi.mocked(getAccountStatus).mockResolvedValue({ role: "ADMIN", lockedAt: null });
  const libraryRecipe = {
    name: "Canh chua tôm", description: "Công thức của thành viên.", instructions: ["Nấu nước dùng", "Cho tôm vào"], prepMinutes: 0,
    cookMinutes: 30, servings: 2, calories: 320, proteinG: 25, carbsG: 20, fatG: 8, cuisine: "Việt Nam", dietTags: ["BALANCED"],
    mealTypes: ["LUNCH"], ingredients: [{ name: "Tôm", quantity: 300, unit: "G" }],
  };

  it("hides and shows a post with an audit entry in the same transaction; a USER gets 403", async () => {
    mocks.findPost.mockResolvedValue({ authorId: otherId, hiddenAt: null, author: { email: "linh@nouri.vn" } });
    expect((await request(admin, `/api/admin/community/posts/${postId}/visibility`, { method: "PATCH", token: token(), body: { hidden: true } })).status)
      .toBe(403);
    asAdmin();
    mocks.findPost.mockResolvedValueOnce({ authorId: otherId, hiddenAt: null, author: { email: "linh@nouri.vn" } })
      .mockResolvedValueOnce({ ...feedRow({ authorId: otherId, hiddenAt: new Date() }), author: { id: otherId, name: "Linh", email: "linh@nouri.vn" } });
    const response = await request(admin, `/api/admin/community/posts/${postId}/visibility`, { method: "PATCH", token: token(), body: { hidden: true } });
    expect(response.status).toBe(200);
    expect(response.body.hidden).toBe(true);
    expect(mocks.updatePost.mock.calls[0][0].data.hiddenAt).toBeInstanceOf(Date);
    expect(mocks.auditCreate.mock.calls[0][0].data).toMatchObject({ action: "POST_HIDE", targetType: "COMMUNITY_POST", targetId: postId });
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.auditCreate)).toBe(true);
  });

  it("creates the library recipe and links the post in one transaction, with a POST_PROMOTE audit entry", async () => {
    asAdmin();
    mocks.createRecipe.mockResolvedValue({ id: recipeId, slug: "canh-chua-tom", name: "Canh chua tôm", ingredients: [] });
    mocks.findPost.mockResolvedValue({ authorId: otherId, memberRecipe, promotedRecipeId: null, author: { email: "linh@nouri.vn" } });
    const response = await request(admin, "/api/admin/recipes", { method: "POST", token: token(), body: { ...libraryRecipe, sourcePostId: postId } });
    expect(response.status).toBe(201);
    expect(mocks.createRecipe.mock.calls[0][0].data).not.toHaveProperty("sourcePostId");
    expect(mocks.updatePosts).toHaveBeenCalledWith({ where: { id: postId, promotedRecipeId: null }, data: { promotedRecipeId: recipeId } });
    expect(mocks.auditCreate.mock.calls.map((call) => call[0].data.action)).toEqual(["RECIPE_CREATE", "POST_PROMOTE"]);
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.auditCreate, 1)).toBe(true);
  });

  it.each([
    ["a post without a member recipe", { memberRecipe: null, promotedRecipeId: null }, 422],
    ["a post already promoted", { memberRecipe, promotedRecipeId: recipeId }, 409],
  ])("refuses %s (the recipe is not kept)", async (_name, row, status) => {
    asAdmin();
    mocks.createRecipe.mockResolvedValue({ id: recipeId, slug: "canh-chua-tom", name: "Canh chua tôm", ingredients: [] });
    mocks.findPost.mockResolvedValue({ authorId: otherId, author: { email: "linh@nouri.vn" }, ...row });
    const response = await request(admin, "/api/admin/recipes", { method: "POST", token: token(), body: { ...libraryRecipe, sourcePostId: postId } });
    expect(response.status).toBe(status);
    expect(mocks.updatePosts).not.toHaveBeenCalled();
  });

  it("answers 409 when another Admin promoted the post at the same moment", async () => {
    asAdmin();
    mocks.createRecipe.mockResolvedValue({ id: recipeId, slug: "canh-chua-tom", name: "Canh chua tôm", ingredients: [] });
    mocks.findPost.mockResolvedValue({ authorId: otherId, memberRecipe, promotedRecipeId: null, author: { email: "linh@nouri.vn" } });
    mocks.updatePosts.mockResolvedValue({ count: 0 });
    const response = await request(admin, "/api/admin/recipes", { method: "POST", token: token(), body: { ...libraryRecipe, sourcePostId: postId } });
    expect(response.status).toBe(409);
  });
});
