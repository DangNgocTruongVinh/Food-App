import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, requestWithCookies, testApp } from "../../test/http-test-utils.js";
import communityRoutes, { commentLimit, likeLimit, postWriteLimit } from "./community.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findPosts: vi.fn(),
  createPost: vi.fn(),
  findPost: vi.fn(),
  findVisiblePost: vi.fn(),
  findUser: vi.fn(),
  findLike: vi.fn(),
  deleteLike: vi.fn(),
  createLike: vi.fn(),
  countLikes: vi.fn(),
  createComment: vi.fn(),
  deleteNotifications: vi.fn(),
  createNotification: vi.fn(),
  transaction: vi.fn(),
  findRecipe: vi.fn(),
  deletePost: vi.fn(),
  createAuditLog: vi.fn(),
  findProfile: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    communityPost: {
      findMany: mocks.findPosts,
      create: mocks.createPost,
      findUnique: mocks.findPost,
      findFirst: mocks.findVisiblePost,
      delete: mocks.deletePost,
    },
    communityLike: {
      findUnique: mocks.findLike,
      delete: mocks.deleteLike,
      count: mocks.countLikes,
    },
    user: { findUnique: mocks.findUser },
    nutritionProfile: { findUnique: mocks.findProfile },
    recipe: { findUnique: mocks.findRecipe },
    notification: { deleteMany: mocks.deleteNotifications },
    adminAuditLog: { create: mocks.createAuditLog },
    $transaction: mocks.transaction,
  },
}));

const app = testApp("/api/community", communityRoutes);
const userId = "cm11111111111111111111111";
const postId = "cm22222222222222222222222";
const ownerId = "cm33333333333333333333333";
const commentId = "cm44444444444444444444444";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "member@nouri.vn" }, mocks.secret)}`;
const author = { id: ownerId, name: "Linh Nhi" };
const createdAt = new Date("2026-09-15T08:00:00.000Z");
const recipeId = "cm55555555555555555555555";
const recipeSummary = {
  id: recipeId, name: "Cá kho tộ (kèm cơm)", imageUrl: "/assets/recipe-salmon.jpg", calories: 520, prepMinutes: 15, cookMinutes: 35,
};
const recipeSelect = { id: true, name: true, imageUrl: true, calories: true, prepMinutes: true, cookMinutes: true, hiddenAt: true, deletedAt: true };
// Bản ghi DB có hiddenAt; phản hồi API thay bằng cờ hidden.
const recipeRow = { ...recipeSummary, hiddenAt: null };
const imagesSelect = { select: { url: true, position: true }, orderBy: { position: "asc" } };
const recipeResponse = { ...recipeSummary, hidden: false, deleted: false };
const promotedSelect = { select: { id: true, name: true } };
const basePost = { id: postId, authorId: ownerId, content: "Bữa trưa", recipeId: null, recipe: null, createdAt, updatedAt: createdAt, author, savedBy: [] };
// findFirst giả: áp đúng điều kiện `where` service gửi (id, OR của visiblePostWhere) lên bản ghi bài giả của findPost,
// để test kiểm quy tắc hiển thị thật chứ không chỉ giá trị dựng sẵn. Cột không có trong bản ghi coi như null (như DB).
type Row = Record<string, unknown>;
const matchesWhere = (where: Row, row: Row): boolean => Object.entries(where).every(([key, value]) => (key === "OR"
  ? (value as Row[]).some((part) => matchesWhere(part, row))
  : value === null ? row[key] == null : row[key] === value));
const createdComment = {
  id: commentId,
  postId,
  authorId: userId,
  content: "Rất hữu ích",
  createdAt,
  updatedAt: createdAt,
  author: { id: userId, name: "Minh An" },
};

beforeEach(() => {
  for (const limit of [postWriteLimit, commentLimit, likeLimit]) limit.reset(); // giới hạn theo tài khoản (S3): mỗi test bắt đầu từ 0
  vi.resetAllMocks();
  mocks.findPosts.mockResolvedValue([]);
  mocks.findProfile.mockResolvedValue(null);
  mocks.createPost.mockResolvedValue(basePost);
  mocks.findPost.mockResolvedValue({ id: postId, authorId: ownerId });
  mocks.findVisiblePost.mockImplementation(async (args: { where: Row }) => {
    const row = await mocks.findPost(args);
    return row && matchesWhere(args.where, row) ? row : null;
  });
  mocks.findRecipe.mockResolvedValue({ id: recipeId, hiddenAt: null });
  mocks.findUser.mockResolvedValue({ name: "Minh An" });
  mocks.findLike.mockResolvedValue(null);
  mocks.deleteLike.mockResolvedValue({});
  mocks.countLikes.mockResolvedValue(1);
  mocks.createLike.mockResolvedValue({ postId, userId });
  mocks.createComment.mockResolvedValue(createdComment);
  mocks.deleteNotifications.mockResolvedValue({ count: 1 });
  mocks.createNotification.mockResolvedValue({});
  mocks.transaction.mockImplementation(async (operation: unknown) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    if (typeof operation === "function") {
      return operation({
        communityLike: { create: mocks.createLike },
        communityComment: { create: mocks.createComment },
        notification: { create: mocks.createNotification },
      });
    }
    throw new Error("Unexpected transaction input");
  });
});

describe("Delete my post (DELETE /api/community/:postId)", () => {
  it("lets the author delete their own post with its community notifications in one transaction (no Admin audit log)", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: userId });
    mocks.deletePost.mockResolvedValue({ id: postId });
    const response = await request(app, `/api/community/${postId}`, { method: "DELETE", token: token() });
    expect(response.status).toBe(204);
    expect(mocks.deleteNotifications).toHaveBeenCalledWith({
      where: { relatedId: postId, type: { in: ["COMMUNITY_LIKE", "COMMUNITY_COMMENT", "COMMUNITY_REPLY"] } },
    });
    expect(mocks.deletePost).toHaveBeenCalledWith({ where: { id: postId } });
    expect(mocks.transaction).toHaveBeenCalledWith([expect.any(Promise), expect.any(Promise)]);
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("returns 404 for someone else's post and keeps it (no notification touched)", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: ownerId });
    expect(await request(app, `/api/community/${postId}`, { method: "DELETE", token: token() }))
      .toEqual({ status: 404, body: { message: "Không tìm thấy bài viết." } });
    expect(mocks.deletePost).not.toHaveBeenCalled();
    expect(mocks.deleteNotifications).not.toHaveBeenCalled();
  });

  it("returns the same 404 for a post that does not exist, 422 for a bad id and 401 without login", async () => {
    mocks.findPost.mockResolvedValue(null);
    expect((await request(app, `/api/community/${postId}`, { method: "DELETE", token: token() })).status).toBe(404);
    expect((await request(app, "/api/community/not-a-cuid", { method: "DELETE", token: token() })).status).toBe(422);
    expect((await request(app, `/api/community/${postId}`, { method: "DELETE" })).status).toBe(401);
    expect(mocks.deletePost).not.toHaveBeenCalled();
  });
});

describe("Community HTTP contract (mock Prisma, no database)", () => {
  it("lists the latest 30 posts and derives viewer-specific counts", async () => {
    mocks.findPosts.mockResolvedValue([{
      ...basePost,
      likes: [{ userId }],
      comments: [createdComment],
      _count: { likes: 4, comments: 1 },
    }]);

    const response = await request(app, "/api/community?take=5&cursor=ignored", { token: token() });
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: postId,
      likedByMe: true,
      likeCount: 4,
      commentCount: 1,
      comments: [expect.objectContaining({ id: commentId })],
    });
    expect(response.body[0]).not.toHaveProperty("likes");
    expect(response.body[0]).not.toHaveProperty("savedBy");
    expect(response.body[0].savedByMe).toBe(false);
    expect(response.body[0]).not.toHaveProperty("_count");
    expect(mocks.findPosts).toHaveBeenCalledWith({
      where: { OR: [{ hiddenAt: null, pendingReviewAt: null }, { authorId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        author: { select: { id: true, name: true, isSample: true } },
        recipe: { select: recipeSelect },
        promotedRecipe: promotedSelect,
        images: imagesSelect,
        likes: { where: { userId }, select: { userId: true } },
        savedBy: { where: { userId }, select: { userId: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, isSample: true } } },
        },
        _count: { select: { likes: true, comments: true } },
      },
    });
  });

  it("creates a trimmed post for the token owner and keeps the response shape", async () => {
    const response = await request(app, "/api/community", {
      method: "POST",
      token: token(),
      body: { content: "  Bữa trưa  ", authorId: ownerId },
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: postId,
      likedByMe: false,
      likeCount: 0,
      commentCount: 0,
      comments: [],
    });
    expect(mocks.createPost).toHaveBeenCalledWith({
      data: { authorId: userId, content: "Bữa trưa", recipeId: null },
      include: {
        author: { select: { id: true, name: true, isSample: true } }, recipe: { select: recipeSelect }, promotedRecipe: promotedSelect, images: imagesSelect,
      },
    });
    expect(mocks.findRecipe).not.toHaveBeenCalled();
  });

  it("returns the attached recipe summary in the feed and null for posts without one", async () => {
    mocks.findPosts.mockResolvedValue([
      { ...basePost, recipeId, recipe: recipeRow, likes: [], comments: [], _count: { likes: 0, comments: 0 } },
      { ...basePost, id: commentId, likes: [], comments: [], _count: { likes: 0, comments: 0 } },
    ]);
    const response = await request(app, "/api/community", { token: token() });
    expect(response.body.map((post: { recipe: unknown }) => post.recipe)).toEqual([recipeResponse, null]);
  });

  it("attaches an existing recipe to a new post", async () => {
    mocks.createPost.mockResolvedValue({ ...basePost, authorId: userId, recipeId, recipe: recipeRow });
    const response = await request(app, "/api/community", {
      method: "POST", token: token(), body: { content: "Món tối nay", recipeId },
    });
    expect(response.status).toBe(201);
    expect(response.body.recipe).toEqual(recipeResponse);
    expect(mocks.findRecipe).toHaveBeenCalledWith({ where: { id: recipeId }, select: { id: true, hiddenAt: true, deletedAt: true } });
    expect(mocks.createPost).toHaveBeenCalledWith({
      data: { authorId: userId, content: "Món tối nay", recipeId },
      include: {
        author: { select: { id: true, name: true, isSample: true } }, recipe: { select: recipeSelect }, promotedRecipe: promotedSelect, images: imagesSelect,
      },
    });
  });

  it.each([
    ["no content", { recipeId }],
    ["blank content", { content: "   ", recipeId }],
  ])("allows a recipe-only post (%s) and stores empty content", async (_name, body) => {
    const response = await request(app, "/api/community", { method: "POST", token: token(), body });
    expect(response.status).toBe(201);
    expect(mocks.createPost.mock.calls[0][0].data).toEqual({ authorId: userId, content: "", recipeId });
  });

  it("rejects a hidden (discontinued) recipe without creating the post", async () => {
    mocks.findRecipe.mockResolvedValue({ id: recipeId, hiddenAt: new Date("2026-10-31T00:00:00.000Z") });
    const response = await request(app, "/api/community", {
      method: "POST", token: token(), body: { content: "Món tối nay", recipeId },
    });
    expect(response).toEqual({ status: 422, body: { message: "Món này đã ngừng sử dụng." } });
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("keeps showing a hidden recipe on old posts, flagged as hidden", async () => {
    mocks.findPosts.mockResolvedValue([{
      ...basePost, recipeId, recipe: { ...recipeSummary, hiddenAt: new Date("2026-10-31T00:00:00.000Z") },
      likes: [], comments: [], _count: { likes: 0, comments: 0 },
    }]);
    const response = await request(app, "/api/community", { token: token() });
    expect(response.body[0].recipe).toEqual({ ...recipeSummary, hidden: true, deleted: false });
  });

  it("rejects a recipe that does not exist without creating the post", async () => {
    mocks.findRecipe.mockResolvedValue(null);
    const response = await request(app, "/api/community", {
      method: "POST", token: token(), body: { content: "Món tối nay", recipeId },
    });
    expect(response).toEqual({ status: 422, body: { message: "Công thức đính kèm không tồn tại." } });
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it.each([
    [{ content: "Món tối nay", recipeId: "not-a-cuid" }],
    [{ content: "Món tối nay", recipeId: 12 }],
    [{ content: "Món tối nay", recipeId: null }],
    [{ content: "   " }],
    [{ content: "a".repeat(2001), recipeId }],
  ])("rejects an invalid post body before calling Prisma %#", async (body) => {
    const response = await request(app, "/api/community", { method: "POST", token: token(), body });
    expect(response.status).toBe(422);
    expect(mocks.findRecipe).not.toHaveBeenCalled();
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("likes another member's post and creates the existing notification in one transaction", async () => {
    const response = await request(app, `/api/community/${postId}/like`, { method: "POST", token: token() });
    expect(response).toEqual({ status: 200, body: { liked: true, likeCount: 1 } });
    expect(mocks.createLike).toHaveBeenCalledWith({ data: { postId, userId } });
    expect(mocks.createNotification).toHaveBeenCalledWith({ data: {
      userId: ownerId,
      type: "COMMUNITY_LIKE",
      title: "Bài viết được yêu thích",
      message: "Minh An đã thích bài viết của bạn.",
      relatedId: postId,
      actionUrl: `/community?post=${encodeURIComponent(postId)}`,
      dedupeKey: `community-like:${postId}:${userId}`,
    } });
    expect(mocks.countLikes).toHaveBeenCalledWith({ where: { postId } });
  });

  it("does not notify a member who likes their own post", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: userId });
    await request(app, `/api/community/${postId}/like`, { method: "POST", token: token() });
    expect(mocks.createLike).toHaveBeenCalledOnce();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("uses the existing anonymous actor label when user data is missing", async () => {
    mocks.findUser.mockResolvedValue(null);
    await request(app, `/api/community/${postId}/like`, { method: "POST", token: token() });
    expect(mocks.createNotification.mock.calls[0][0].data.message).toBe("Một thành viên đã thích bài viết của bạn.");
  });

  it("unlikes inside the existing transaction and removes its deduplicated notification", async () => {
    mocks.findLike.mockResolvedValue({ postId, userId });
    mocks.countLikes.mockResolvedValue(0);
    const response = await request(app, `/api/community/${postId}/like`, { method: "POST", token: token() });
    expect(response).toEqual({ status: 200, body: { liked: false, likeCount: 0 } });
    expect(mocks.deleteLike).toHaveBeenCalledWith({ where: { postId_userId: { postId, userId } } });
    expect(mocks.deleteNotifications).toHaveBeenCalledWith({ where: { dedupeKey: `community-like:${postId}:${userId}` } });
    expect(mocks.transaction).toHaveBeenCalledWith([expect.any(Promise), expect.any(Promise)]);
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a like when the post does not exist", async () => {
    mocks.findPost.mockResolvedValue(null);
    const response = await request(app, `/api/community/${postId}/like`, { method: "POST", token: token() });
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy bài viết." } });
    expect(mocks.findLike).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a trimmed comment and the existing notification atomically", async () => {
    const response = await request(app, `/api/community/${postId}/comments`, {
      method: "POST",
      token: token(),
      body: { content: "  Rất hữu ích  ", authorId: ownerId },
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: commentId, content: "Rất hữu ích" });
    expect(mocks.createComment).toHaveBeenCalledWith({
      data: { postId, authorId: userId, content: "Rất hữu ích" },
      include: { author: { select: { id: true, name: true, isSample: true } } },
    });
    expect(mocks.createNotification).toHaveBeenCalledWith({ data: {
      userId: ownerId,
      type: "COMMUNITY_COMMENT",
      title: "Bình luận mới",
      message: "Minh An đã bình luận bài viết của bạn.",
      relatedId: postId,
      actionUrl: `/community?post=${encodeURIComponent(postId)}`,
      dedupeKey: `community-comment:${commentId}`,
    } });
  });

  it("does not notify a member who comments on their own post", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: userId });
    await request(app, `/api/community/${postId}/comments`, {
      method: "POST", token: token(), body: { content: "Ghi chú" },
    });
    expect(mocks.createComment).toHaveBeenCalledOnce();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("rejects a comment when the post does not exist", async () => {
    mocks.findPost.mockResolvedValue(null);
    const response = await request(app, `/api/community/${postId}/comments`, {
      method: "POST", token: token(), body: { content: "Ghi chú" },
    });
    expect(response).toEqual({ status: 404, body: { message: "Không tìm thấy bài viết." } });
    expect(mocks.createComment).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/community", undefined],
    ["POST", "/api/community", { content: "Bài viết" }],
    ["POST", `/api/community/${postId}/like`, undefined],
    ["POST", `/api/community/${postId}/comments`, { content: "Bình luận" }],
  ])("requires authentication for %s %s", async (method, path, body) => {
    const response = await request(app, path, { method, body });
    expect(response.status).toBe(401);
    expect(mocks.findPosts).not.toHaveBeenCalled();
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it.each([
    [{}, "/api/community"],
    [{ content: "" }, "/api/community"],
    [{ content: "a".repeat(2001) }, "/api/community"],
    [{ content: 12 }, "/api/community"],
    [{}, `/api/community/${postId}/comments`],
    [{ content: "" }, `/api/community/${postId}/comments`],
    [{ content: "a".repeat(501) }, `/api/community/${postId}/comments`],
  ])("rejects invalid content %#", async (body, path) => {
    const response = await request(app, path, { method: "POST", token: token(), body });
    expect(response.status).toBe(422);
    expect(mocks.createPost).not.toHaveBeenCalled();
    expect(mocks.createComment).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", "/api/community/not-a-cuid/like", undefined],
    ["POST", "/api/community/not-a-cuid/comments", { content: "Bình luận" }],
  ])("rejects an invalid post id for %s %s", async (method, path, body) => {
    const response = await request(app, path, { method, token: token(), body });
    expect(response.status).toBe(422);
    expect(mocks.findPost).not.toHaveBeenCalled();
  });

  it.each([
    ["feed", () => mocks.findPosts.mockRejectedValue(new Error("database unavailable")), "GET", "/api/community", undefined],
    ["publish", () => mocks.createPost.mockRejectedValue(new Error("database unavailable")), "POST", "/api/community", { content: "Bài viết" }],
    ["like", () => mocks.findPost.mockRejectedValue(new Error("database unavailable")), "POST", `/api/community/${postId}/like`, undefined],
    ["comment", () => mocks.findPost.mockRejectedValue(new Error("database unavailable")), "POST", `/api/community/${postId}/comments`, { content: "Bình luận" }],
  ])("uses the shared 500 response when %s fails", async (_name, arrange, method, path, body) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    arrange();
    const response = await request(app, path, { method, token: token(), body });
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("message");
  });
});

// Audit S1: thích/bỏ thích và bình luận chỉ trên bài người gọi được thấy, cùng quy tắc với bảng tin (visiblePostWhere).
describe("Thích và bình luận chỉ trên bài được thấy (audit S1)", () => {
  const hidden = new Date("2026-11-20T08:00:00.000Z");
  const like = () => request(app, `/api/community/${postId}/like`, { method: "POST", token: token() });
  const comment = () => request(app, `/api/community/${postId}/comments`, { method: "POST", token: token(), body: { content: "Ngon quá" } });
  const notFound = { status: 404, body: { message: "Không tìm thấy bài viết." } };

  it("tìm bài bằng đúng điều kiện của bảng tin: id + visiblePostWhere của người gọi", async () => {
    await like();
    await comment();
    const visible = { OR: [{ hiddenAt: null, pendingReviewAt: null }, { authorId: userId }] };
    for (const [args] of mocks.findVisiblePost.mock.calls) expect(args.where).toEqual({ id: postId, ...visible });
    expect(mocks.findVisiblePost).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["bị Admin ẩn", { id: postId, authorId: ownerId, hiddenAt: hidden, pendingReviewAt: null }],
    ["đang chờ duyệt (người khác gọi)", { id: postId, authorId: ownerId, hiddenAt: null, pendingReviewAt: hidden }],
  ])("bài %s: thích, bỏ thích và bình luận đều 404 như bài không tồn tại, không ghi gì, không thông báo", async (_label, row) => {
    mocks.findPost.mockResolvedValue(row);
    expect(await like()).toEqual(notFound);
    mocks.findLike.mockResolvedValue({ postId, userId }); // đã thích từ trước khi bài bị ẩn: bỏ thích cũng bị chặn
    expect(await like()).toEqual(notFound);
    expect(await comment()).toEqual(notFound);
    expect(mocks.createLike).not.toHaveBeenCalled();
    expect(mocks.deleteLike).not.toHaveBeenCalled();
    expect(mocks.createComment).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
    expect(mocks.deleteNotifications).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("bài đang chờ duyệt của chính tác giả: tác giả thích và bình luận được (tác giả luôn thấy bài mình), không tự thông báo", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: userId, hiddenAt: null, pendingReviewAt: hidden });
    mocks.createComment.mockResolvedValue({ ...createdComment, content: "Ngon quá" });
    expect(await like()).toEqual({ status: 200, body: { liked: true, likeCount: 1 } });
    expect((await comment()).status).toBe(201);
    expect(mocks.createLike).toHaveBeenCalledWith({ data: { postId, userId } });
    expect(mocks.createComment).toHaveBeenCalledOnce();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });

  it("bài bình thường của người khác: thích và bình luận được, tác giả nhận đúng hai thông báo", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: ownerId, hiddenAt: null, pendingReviewAt: null });
    expect(await like()).toEqual({ status: 200, body: { liked: true, likeCount: 1 } });
    expect((await comment()).status).toBe(201);
    expect(mocks.createNotification).toHaveBeenCalledTimes(2);
    expect(mocks.createNotification.mock.calls.map(([args]) => args.data.type)).toEqual(["COMMUNITY_LIKE", "COMMUNITY_COMMENT"]);
    expect(mocks.createNotification.mock.calls.every(([args]) => args.data.userId === ownerId)).toBe(true);
  });
});

// Audit R4: hai yêu cầu thích cùng một bài gửi cùng lúc (bấm đúp, hai thiết bị). Cả hai đọc thấy "chưa thích" rồi cùng tạo lượt thích;
// lần tạo sau vướng khóa chính (postId, userId) của CommunityLike → P2002. Không được trả 500.
describe("Thích đồng thời cùng một bài (audit R4)", () => {
  it("hai yêu cầu cùng lúc: một 200, một 409 có thông báo dễ hiểu; không yêu cầu nào 500, không lộ chi tiết DB", async () => {
    mocks.createLike
      .mockResolvedValueOnce({ postId, userId })
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`postId`,`userId`)", {
        code: "P2002", clientVersion: "test", meta: { modelName: "CommunityLike", target: ["postId", "userId"] },
      }));
    const like = () => request(app, `/api/community/${postId}/like`, { method: "POST", token: token() });
    const responses = await Promise.all([like(), like()]);
    expect(mocks.findLike).toHaveBeenCalledTimes(2); // cả hai đều đọc thấy "chưa thích" trước khi ghi
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const conflict = responses.find((response) => response.status === 409)!;
    expect(conflict.body).toEqual({ message: "Dữ liệu vừa thay đổi, vui lòng tải lại rồi thử lại." });
    expect(JSON.stringify(conflict.body)).not.toMatch(/CommunityLike|postId|Unique/);
  });
});

// Audit S3: giới hạn theo tài khoản (không theo IP). Mọi request trong test đều từ 127.0.0.1, nên hai người dùng dưới đây CÙNG IP.
describe("Giới hạn tần suất theo tài khoản ở cộng đồng (audit S3)", () => {
  const other = () => `Bearer ${jwt.sign({ sub: ownerId, email: "other@nouri.vn" }, mocks.secret)}`;
  const send = (path: string, body?: unknown, as = token()) => requestWithCookies(app, path, { method: "POST", token: as, body });
  const expectLimited = (response: Awaited<ReturnType<typeof send>>, message: string) => {
    expect(response.status).toBe(429);
    expect(response.body).toEqual({ message });
    expect(Number(response.retryAfter)).toBeGreaterThan(0);
  };

  it("đăng bài: 10 lần/giờ; lần thứ 11 → 429; người dùng khác cùng IP vẫn đăng được", async () => {
    for (let i = 1; i <= 10; i += 1) expect((await send("/api/community", { content: `Bài ${i}` })).status).toBe(201);
    expectLimited(await send("/api/community", { content: "Bài 11" }), "Bạn đã đăng hoặc sửa bài 10 lần trong 1 giờ. Vui lòng thử lại sau.");
    expect(mocks.createPost).toHaveBeenCalledTimes(10);
    expect((await send("/api/community", { content: "Bài của người khác" }, other())).status).toBe(201);
  });

  it("bình luận: 20 lần/10 phút; lần thứ 21 → 429; người dùng khác cùng IP vẫn bình luận được", async () => {
    for (let i = 1; i <= 20; i += 1) expect((await send(`/api/community/${postId}/comments`, { content: `Ý kiến ${i}` })).status).toBe(201);
    expectLimited(await send(`/api/community/${postId}/comments`, { content: "Ý kiến 21" }), "Bạn bình luận quá nhanh. Vui lòng đợi vài phút rồi thử lại.");
    expect(mocks.createComment).toHaveBeenCalledTimes(20);
    expect((await send(`/api/community/${postId}/comments`, { content: "Hay quá" }, other())).status).toBe(201);
  });

  it("thích/bỏ thích: 60 lần/phút; lần thứ 61 → 429; người dùng khác cùng IP vẫn thích được", async () => {
    for (let i = 1; i <= 60; i += 1) expect((await send(`/api/community/${postId}/like`)).status).toBe(200);
    expectLimited(await send(`/api/community/${postId}/like`), "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.");
    expect(mocks.createLike).toHaveBeenCalledTimes(60);
    expect((await send(`/api/community/${postId}/like`, undefined, other())).status).toBe(200);
  });
});
