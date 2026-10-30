import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountStatus } from "../../services/account-status.service.js";
import { request, testApp } from "../../test/http-test-utils.js";
import adminRoutes from "./admin.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  userCount: vi.fn(), userFindMany: vi.fn(), userFindUnique: vi.fn(), userUpdate: vi.fn(),
  postCount: vi.fn(), postFindMany: vi.fn(), postFindUnique: vi.fn(), postDelete: vi.fn(),
  commentFindUnique: vi.fn(), commentDelete: vi.fn(),
  notificationDeleteMany: vi.fn(),
  planCount: vi.fn(), planFindMany: vi.fn(),
  recipeCount: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  user: { count: mocks.userCount, findMany: mocks.userFindMany, findUnique: mocks.userFindUnique, update: mocks.userUpdate },
  communityPost: { count: mocks.postCount, findMany: mocks.postFindMany, findUnique: mocks.postFindUnique, delete: mocks.postDelete },
  communityComment: { findUnique: mocks.commentFindUnique, delete: mocks.commentDelete },
  notification: { deleteMany: mocks.notificationDeleteMany },
  mealPlan: { count: mocks.planCount, findMany: mocks.planFindMany },
  recipe: { count: mocks.recipeCount },
  $transaction: mocks.transaction,
} }));

const app = testApp("/api/admin", adminRoutes);
const adminId = "cm11111111111111111111111";
const userId = "cm22222222222222222222222";
const otherAdminId = "cm33333333333333333333333";
const postId = "cm44444444444444444444444";
const commentId = "cm55555555555555555555555";
const token = () => `Bearer ${jwt.sign({ sub: adminId, email: "admin@nouri.vn" }, mocks.secret)}`;
const accountStatus = vi.mocked(getAccountStatus);

beforeEach(() => {
  vi.resetAllMocks();
  accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: null });
  for (const count of [mocks.userCount, mocks.postCount, mocks.planCount, mocks.recipeCount]) count.mockResolvedValue(0);
  for (const list of [mocks.userFindMany, mocks.postFindMany, mocks.planFindMany]) list.mockResolvedValue([]);
  mocks.userFindUnique.mockResolvedValue({ id: userId, role: "USER", lockedAt: null });
  mocks.userUpdate.mockImplementation(async ({ data }) => ({ id: userId, lockedAt: data.lockedAt }));
  mocks.postFindUnique.mockResolvedValue({ id: postId, authorId: userId });
  mocks.commentFindUnique.mockResolvedValue({ id: commentId, authorId: userId });
  mocks.notificationDeleteMany.mockResolvedValue({ count: 2 });
  mocks.postDelete.mockResolvedValue({ id: postId });
  mocks.commentDelete.mockResolvedValue({ id: commentId });
  mocks.transaction.mockImplementation(async (operation: unknown) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    if (typeof operation === "function") return operation({ user: { update: mocks.userUpdate } });
    throw new Error("Unexpected transaction input");
  });
});

const endpoints = [
  ["GET", "/api/admin/users", undefined, 200],
  ["PATCH", `/api/admin/users/${userId}/lock`, { locked: true }, 200],
  ["GET", "/api/admin/community/posts", undefined, 200],
  ["DELETE", `/api/admin/community/posts/${postId}`, undefined, 204],
  ["DELETE", `/api/admin/community/comments/${commentId}`, undefined, 204],
  ["GET", "/api/admin/stats", undefined, 200],
] as const;

const writes = () => [mocks.userUpdate, mocks.postDelete, mocks.commentDelete, mocks.notificationDeleteMany, mocks.transaction];

describe("Admin users / moderation / stats permission matrix", () => {
  it.each(endpoints)("%s %s → 401 without login", async (method, path, body) => {
    expect((await request(app, path, { method, body })).status).toBe(401);
    expect(writes().every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it.each(endpoints)("%s %s → 403 for a USER account", async (method, path, body) => {
    accountStatus.mockResolvedValue({ role: "USER", lockedAt: null });
    expect((await request(app, path, { method, body, token: token() })).status).toBe(403);
    expect(writes().every((mock) => mock.mock.calls.length === 0)).toBe(true);
  });

  it.each(endpoints)("%s %s → 403 ACCOUNT_LOCKED for a locked admin", async (method, path, body) => {
    accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: new Date() });
    const response = await request(app, path, { method, body, token: token() });
    expect(response.status).toBe(403);
    expect(response.body.details).toEqual({ code: "ACCOUNT_LOCKED" });
  });

  it.each(endpoints)("%s %s → %s for an ADMIN account", async (method, path, body, status) => {
    expect((await request(app, path, { method, body, token: token() })).status).toBe(status);
  });
});

describe("Admin user management", () => {
  it("lists users with search on name/email, pagination ≤ 50 and post/meal plan counts", async () => {
    mocks.userCount.mockResolvedValue(61);
    mocks.userFindMany.mockResolvedValue([{
      id: userId, name: "Minh Anh", email: "demo@nouri.vn", role: "USER", lockedAt: null, createdAt: new Date("2026-10-01T00:00:00.000Z"),
      _count: { communityPosts: 4, mealPlans: 2 },
    }]);
    const response = await request(app, "/api/admin/users?search=minh&page=2&pageSize=50", { token: token() });
    expect(response.body).toMatchObject({ total: 61, page: 2, pageSize: 50 });
    expect(response.body.items[0]).toMatchObject({ email: "demo@nouri.vn", locked: false, postCount: 4, mealPlanCount: 2 });
    expect(response.body.items[0]).not.toHaveProperty("_count");
    expect(response.body.items[0]).not.toHaveProperty("passwordHash");
    const where = { OR: [{ name: { contains: "minh", mode: "insensitive" } }, { email: { contains: "minh", mode: "insensitive" } }] };
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 50, take: 50 }));
    expect((await request(app, "/api/admin/users?pageSize=51", { token: token() })).status).toBe(422);
  });

  it("locks and unlocks a USER account", async () => {
    const locked = await request(app, `/api/admin/users/${userId}/lock`, { method: "PATCH", token: token(), body: { locked: true } });
    expect(locked.body).toMatchObject({ id: userId, locked: true });
    expect(mocks.userUpdate.mock.calls[0][0].data.lockedAt).toBeInstanceOf(Date);
    const unlocked = await request(app, `/api/admin/users/${userId}/lock`, { method: "PATCH", token: token(), body: { locked: false } });
    expect(unlocked.body).toEqual({ id: userId, lockedAt: null, locked: false });
  });

  it("keeps the first lock time when locking an already locked account", async () => {
    const first = new Date("2026-10-20T00:00:00.000Z");
    mocks.userFindUnique.mockResolvedValue({ id: userId, role: "USER", lockedAt: first });
    await request(app, `/api/admin/users/${userId}/lock`, { method: "PATCH", token: token(), body: { locked: true } });
    expect(mocks.userUpdate.mock.calls[0][0].data.lockedAt).toEqual(first);
  });

  it("refuses to lock yourself (400) before reading the target", async () => {
    const response = await request(app, `/api/admin/users/${adminId}/lock`, { method: "PATCH", token: token(), body: { locked: true } });
    expect(response).toEqual({ status: 400, body: { message: "Bạn không thể tự khóa hoặc mở khóa tài khoản của mình." } });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("refuses to lock another admin (403) and returns 404 for an unknown user", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: otherAdminId, role: "ADMIN", lockedAt: null });
    expect((await request(app, `/api/admin/users/${otherAdminId}/lock`, { method: "PATCH", token: token(), body: { locked: true } })))
      .toEqual({ status: 403, body: { message: "Không thể khóa hoặc mở khóa tài khoản Admin khác." } });
    mocks.userFindUnique.mockResolvedValue(null);
    expect((await request(app, `/api/admin/users/${userId}/lock`, { method: "PATCH", token: token(), body: { locked: true } })).status).toBe(404);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});

describe("Admin moderation (shared delete service)", () => {
  it("deletes any member's post together with its community notifications in one transaction", async () => {
    mocks.postFindUnique.mockResolvedValue({ id: postId, authorId: "someone-else" });
    expect((await request(app, `/api/admin/community/posts/${postId}`, { method: "DELETE", token: token() })).status).toBe(204);
    expect(mocks.notificationDeleteMany).toHaveBeenCalledWith({
      where: { relatedId: postId, type: { in: ["COMMUNITY_LIKE", "COMMUNITY_COMMENT", "COMMUNITY_REPLY"] } },
    });
    expect(mocks.postDelete).toHaveBeenCalledWith({ where: { id: postId } });
    expect(mocks.transaction).toHaveBeenCalledWith([expect.any(Promise), expect.any(Promise)]);
  });

  it("deletes any comment together with its notification", async () => {
    expect((await request(app, `/api/admin/community/comments/${commentId}`, { method: "DELETE", token: token() })).status).toBe(204);
    expect(mocks.notificationDeleteMany).toHaveBeenCalledWith({ where: { dedupeKey: `community-comment:${commentId}` } });
    expect(mocks.commentDelete).toHaveBeenCalledWith({ where: { id: commentId } });
  });

  it("returns 404 for a missing post or comment", async () => {
    mocks.postFindUnique.mockResolvedValue(null);
    mocks.commentFindUnique.mockResolvedValue(null);
    expect((await request(app, `/api/admin/community/posts/${postId}`, { method: "DELETE", token: token() })).status).toBe(404);
    expect((await request(app, `/api/admin/community/comments/${commentId}`, { method: "DELETE", token: token() })).status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("lists posts newest first with author email, comments and counts", async () => {
    mocks.postCount.mockResolvedValue(1);
    mocks.postFindMany.mockResolvedValue([{
      id: postId, content: "Bài vi phạm", recipe: null, author: { id: userId, name: "Minh Anh", email: "demo@nouri.vn" },
      comments: [], _count: { likes: 3, comments: 0 },
    }]);
    const response = await request(app, "/api/admin/community/posts?page=1&pageSize=10", { token: token() });
    expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 10, items: [{ id: postId, likeCount: 3, commentCount: 0, recipe: null }] });
    expect(mocks.postFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "desc" }, skip: 0, take: 10 }));
  });
});

describe("Admin stats", () => {
  it("returns totals and 12 Vietnam weeks with empty weeks filled with 0", async () => {
    mocks.userCount.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    mocks.planCount.mockResolvedValue(7);
    mocks.postCount.mockResolvedValue(3);
    mocks.recipeCount.mockResolvedValueOnce(33).mockResolvedValueOnce(2);
    mocks.userFindMany.mockResolvedValue([{ createdAt: new Date() }]);
    const response = await request(app, "/api/admin/stats", { token: token() });
    expect(response.body.totals).toEqual({ users: 5, lockedUsers: 1, mealPlans: 7, posts: 3, recipes: 33, hiddenRecipes: 2 });
    expect(response.body.timeZone).toBe("Asia/Ho_Chi_Minh");
    expect(response.body.weekly).toHaveLength(12);
    expect(response.body.weekly.at(-1)).toMatchObject({ users: 1, mealPlans: 0, posts: 0 });
    expect(mocks.userCount).toHaveBeenCalledWith({ where: { lockedAt: { not: null } } });
    expect(mocks.recipeCount).toHaveBeenCalledWith({ where: { hiddenAt: { not: null } } });
  });
});
