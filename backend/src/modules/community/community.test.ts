import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request, testApp } from "../../test/http-test-utils.js";
import communityRoutes from "./community.routes.js";

const mocks = vi.hoisted(() => ({
  secret: "nouri-test-only-secret-at-least-32-characters",
  findPosts: vi.fn(),
  createPost: vi.fn(),
  findPost: vi.fn(),
  findUser: vi.fn(),
  findLike: vi.fn(),
  deleteLike: vi.fn(),
  createLike: vi.fn(),
  countLikes: vi.fn(),
  createComment: vi.fn(),
  deleteNotifications: vi.fn(),
  createNotification: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: mocks.secret } }));
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    communityPost: {
      findMany: mocks.findPosts,
      create: mocks.createPost,
      findUnique: mocks.findPost,
    },
    communityLike: {
      findUnique: mocks.findLike,
      delete: mocks.deleteLike,
      count: mocks.countLikes,
    },
    user: { findUnique: mocks.findUser },
    notification: { deleteMany: mocks.deleteNotifications },
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
const basePost = { id: postId, authorId: ownerId, content: "Bữa trưa", createdAt, updatedAt: createdAt, author };
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
  vi.resetAllMocks();
  mocks.findPosts.mockResolvedValue([]);
  mocks.createPost.mockResolvedValue(basePost);
  mocks.findPost.mockResolvedValue({ id: postId, authorId: ownerId });
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
    expect(response.body[0]).not.toHaveProperty("_count");
    expect(mocks.findPosts).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        author: { select: { id: true, name: true } },
        likes: { where: { userId }, select: { userId: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
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
      data: { authorId: userId, content: "Bữa trưa" },
      include: { author: { select: { id: true, name: true } } },
    });
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
      include: { author: { select: { id: true, name: true } } },
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
