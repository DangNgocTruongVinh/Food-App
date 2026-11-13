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
  review: vi.fn(), countPosts: vi.fn(), findFirstPost: vi.fn(), findSaved: vi.fn(), createSaved: vi.fn(), deleteSaved: vi.fn(),
  findProfile: vi.fn(), findRecipes: vi.fn(), createRecipe: vi.fn(), auditCreate: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  communityPost: {
    findMany: mocks.findPosts, count: mocks.countPosts, findUnique: mocks.findPost, findFirst: mocks.findFirstPost, create: mocks.createPost, update: mocks.updatePost, updateMany: mocks.updatePosts,
  },
  nutritionProfile: { findUnique: mocks.findProfile },
  recipe: { findMany: mocks.findRecipes, create: mocks.createRecipe },
  adminAuditLog: { create: mocks.auditCreate },
  savedPost: { findMany: mocks.findSaved, createMany: mocks.createSaved, deleteMany: mocks.deleteSaved },
  $transaction: mocks.transaction,
} }));
// AI kiểm duyệt giả lập: mặc định null (không có key / API lỗi → đăng như thường).
vi.mock("./community-ai-review.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("./community-ai-review.js")>(), reviewCommunityPost: mocks.review,
}));

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
  likes: [], savedBy: [], comments: [], _count: { likes: 0, comments: 0 }, ...extra,
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
  mocks.review.mockResolvedValue(null);
  mocks.countPosts.mockResolvedValue(0);
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
    expect(memberRecipeAllergens(memberRecipe, ["Hải sản"]).join(" ")).toMatch(/Giáp xác \(.*Tôm/i);
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
    expect(response.body[0].memberRecipeAllergens).toEqual(["Giáp xác (Tôm)"]);
    expect(mocks.findPosts.mock.calls[0][0].where).toEqual({ OR: [{ hiddenAt: null, pendingReviewAt: null }, { authorId: userId }] });
  });

  it("lets only the author edit; others and missing posts get the same 404", async () => {
    mocks.findPost.mockResolvedValue({ authorId: otherId, recipeId: null, images: [], _count: { images: 0 } });
    const body = { content: "Sửa", memberRecipe };
    expect(await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body }))
      .toEqual({ status: 404, body: { message: "Không tìm thấy bài viết." } });
    mocks.findPost.mockResolvedValue(null);
    expect((await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body })).status).toBe(404);
    expect(mocks.updatePost).not.toHaveBeenCalled();
  });

  it("edits the author's post, removes the recipe with null, and keeps the post non-empty", async () => {
    mocks.findPost.mockResolvedValue({ authorId: userId, recipeId: null, images: [], _count: { images: 0 } });
    const ok = await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body: { content: "Mới", memberRecipe } });
    expect(ok.status).toBe(200);
    expect(mocks.updatePost.mock.calls[0][0].data).toEqual({ content: "Mới", memberRecipe });
    const empty = await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body: { content: "", memberRecipe: null } });
    expect(empty.status).toBe(422);
    mocks.findPost.mockResolvedValue({ authorId: userId, recipeId, images: [], _count: { images: 0 } });
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

describe("AI kiểm duyệt bài (phản hồi giả lập)", () => {
  const asAdmin = () => vi.mocked(getAccountStatus).mockResolvedValue({ role: "ADMIN", lockedAt: null });
  const flagged = { flagged: true, reason: "Có thể không liên quan ăn uống: Quảng cáo." };

  it("bài nghi vấn → lưu chờ duyệt kèm lý do AI; tác giả thấy pendingReview, không thấy lý do", async () => {
    mocks.review.mockResolvedValue(flagged);
    mocks.createPost.mockResolvedValue(feedRow({ pendingReviewAt: new Date(), aiReviewReason: flagged.reason }));
    const response = await request(community, "/api/community", { method: "POST", token: token(), body: { content: "Bán điện thoại" } });
    expect(response.status).toBe(201);
    expect(mocks.review).toHaveBeenCalledWith({ text: "Bán điện thoại", imageUrls: [] });
    const data = mocks.createPost.mock.calls[0][0].data;
    expect(data.pendingReviewAt).toBeInstanceOf(Date);
    expect(data.aiReviewReason).toBe(flagged.reason);
    expect(response.body).toMatchObject({ pendingReview: true, hidden: false });
    expect(response.body).not.toHaveProperty("aiReviewReason");
    expect(response.body).not.toHaveProperty("pendingReviewAt");
  });

  it("bài sạch hoặc AI không kiểm được → đăng ngay, không có trường chờ duyệt", async () => {
    for (const review of [{ flagged: false, reason: null }, null]) {
      mocks.createPost.mockClear();
      mocks.review.mockResolvedValue(review);
      await request(community, "/api/community", { method: "POST", token: token(), body: { content: "Canh chua" } });
      expect(mocks.createPost.mock.calls[0][0].data).toEqual({ authorId: userId, content: "Canh chua", recipeId: null });
    }
  });

  it("sửa bài thành nội dung nghi vấn → chờ duyệt lại (kiểm cả ảnh đang có)", async () => {
    mocks.review.mockResolvedValue(flagged);
    mocks.findPost.mockResolvedValue({ authorId: userId, recipeId: null, images: [{ url: "https://img/a.jpg" }], _count: { images: 1 } });
    await request(community, `/api/community/${postId}`, { method: "PATCH", token: token(), body: { content: "Mới", memberRecipe: null } });
    expect(mocks.review).toHaveBeenCalledWith({ text: "Mới", imageUrls: ["https://img/a.jpg"] });
    expect(mocks.updatePost.mock.calls[0][0].data).toMatchObject({ pendingReviewAt: expect.any(Date), aiReviewReason: flagged.reason });
  });

  it("Admin lọc 'AI đánh dấu': chỉ bài đang chờ duyệt, kèm lý do AI", async () => {
    asAdmin();
    mocks.countPosts.mockResolvedValue(1);
    mocks.findPosts.mockResolvedValue([{ ...feedRow({ pendingReviewAt: new Date(), aiReviewReason: flagged.reason }), author: { id: otherId, name: "Linh", email: "l@n.vn" } }]);
    const response = await request(admin, "/api/admin/community/posts?filter=ai", { token: token() });
    expect(response.status).toBe(200);
    expect(mocks.findPosts.mock.calls[0][0].where).toEqual({ pendingReviewAt: { not: null } });
    expect(response.body.items[0]).toMatchObject({ pendingReview: true, aiReviewReason: flagged.reason });
  });

  it.each([
    ["approve", "POST_APPROVE", undefined],
    ["hide", "POST_HIDE", expect.any(Date)],
  ] as const)("Admin %s: bỏ chờ duyệt, ghi nhật ký %s trong cùng transaction; không xóa bài", async (decision, action, hiddenAt) => {
    asAdmin();
    mocks.findPost.mockResolvedValueOnce({ authorId: otherId, pendingReviewAt: new Date(), author: { email: "linh@nouri.vn" } })
      .mockResolvedValueOnce({ ...feedRow({ authorId: otherId }), author: { id: otherId, name: "Linh", email: "linh@nouri.vn" } });
    const response = await request(admin, `/api/admin/community/posts/${postId}/review`, { method: "PATCH", token: token(), body: { decision } });
    expect(response.status).toBe(200);
    const data = mocks.updatePost.mock.calls[0][0].data;
    expect(data.pendingReviewAt).toBeNull();
    expect(data.hiddenAt).toEqual(hiddenAt);
    expect(mocks.auditCreate.mock.calls[0][0].data).toMatchObject({ action, targetType: "COMMUNITY_POST", targetId: postId });
    expect(tx.wasCalledInTransaction(mocks.transaction, mocks.auditCreate)).toBe(true);
  });

  it("bài không còn chờ duyệt → 409; USER → 403", async () => {
    mocks.findPost.mockResolvedValue({ authorId: otherId, pendingReviewAt: null, author: { email: "linh@nouri.vn" } });
    const body = { decision: "approve" };
    expect((await request(admin, `/api/admin/community/posts/${postId}/review`, { method: "PATCH", token: token(), body })).status).toBe(403);
    asAdmin();
    expect((await request(admin, `/api/admin/community/posts/${postId}/review`, { method: "PATCH", token: token(), body })).status).toBe(409);
    expect(mocks.updatePost).not.toHaveBeenCalled();
  });
});

describe("UC25 Lưu bài viết", () => {
  const visible = { OR: [{ hiddenAt: null, pendingReviewAt: null }, { authorId: userId }] };

  it("lưu bài người dùng thấy được: ghi cho đúng người trong JWT, không trùng", async () => {
    mocks.findFirstPost.mockResolvedValue({ id: postId });
    mocks.createSaved.mockResolvedValue({ count: 1 });
    const response = await request(community, `/api/community/${postId}/save`, { method: "PUT", token: token() });
    expect(response).toEqual({ status: 200, body: { postId, saved: true } });
    expect(mocks.findFirstPost.mock.calls[0][0].where).toEqual({ id: postId, ...visible });
    expect(mocks.createSaved).toHaveBeenCalledWith({ data: [{ userId, postId }], skipDuplicates: true });
  });

  it("bài bị ẩn / chờ duyệt / không tồn tại → 404, không lưu", async () => {
    mocks.findFirstPost.mockResolvedValue(null);
    expect((await request(community, `/api/community/${postId}/save`, { method: "PUT", token: token() })).status).toBe(404);
    expect(mocks.createSaved).not.toHaveBeenCalled();
  });

  it("bỏ lưu chỉ xóa của chính người dùng", async () => {
    mocks.deleteSaved.mockResolvedValue({ count: 1 });
    const response = await request(community, `/api/community/${postId}/save`, { method: "DELETE", token: token() });
    expect(response.body).toEqual({ postId, saved: false });
    expect(mocks.deleteSaved).toHaveBeenCalledWith({ where: { userId, postId } });
  });

  it("\"Bài đã lưu\": chỉ của người trong JWT, bài bị ẩn/chờ duyệt tự biến mất (cùng điều kiện bảng tin), mới lưu trước", async () => {
    mocks.findSaved.mockResolvedValue([{ post: feedRow({ authorId: otherId, savedBy: [{ userId }] }) }]);
    const response = await request(community, "/api/community/saved", { token: token() });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([expect.objectContaining({ id: postId, savedByMe: true })]);
    const query = mocks.findSaved.mock.calls[0][0];
    expect(query.where).toEqual({ userId, post: visible });
    expect(query.orderBy).toEqual({ createdAt: "desc" });
    expect(query.select.post.include.savedBy).toEqual({ where: { userId }, select: { userId: true } });
  });

  it("cần đăng nhập", async () => {
    expect((await request(community, "/api/community/saved")).status).toBe(401);
  });
});
