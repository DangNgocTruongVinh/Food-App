import sharp from "sharp";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exifHasGps, jpegWithGps } from "../../test/image-fixtures.js";
import { request, testApp } from "../../test/http-test-utils.js";
import communityRoutes from "./community.routes.js";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  createPost: vi.fn(), findPost: vi.fn(), deletePost: vi.fn(), findRecipe: vi.fn(),
  deleteNotifications: vi.fn(), transaction: vi.fn(),
  uploadStream: vi.fn(), destroy: vi.fn(),
  uploadedBuffers: [] as Buffer[],
}));

vi.mock("../../config/env.js", () => ({ env: mocks.env }));
vi.mock("../../lib/prisma.js", () => ({ prisma: {
  communityPost: { create: mocks.createPost, findUnique: mocks.findPost, delete: mocks.deletePost },
  recipe: { findUnique: mocks.findRecipe },
  notification: { deleteMany: mocks.deleteNotifications },
  $transaction: mocks.transaction,
} }));
vi.mock("cloudinary", () => ({ v2: { config: vi.fn(), uploader: { upload_stream: mocks.uploadStream, destroy: mocks.destroy } } }));

const secret = "nouri-test-only-secret-at-least-32-characters";
const app = testApp("/api/community", communityRoutes);
const userId = "cm11111111111111111111111";
const postId = "cm22222222222222222222222";
const token = () => `Bearer ${jwt.sign({ sub: userId, email: "demo@nouri.vn" }, secret)}`;
const configure = (on: boolean) => Object.assign(mocks.env, {
  JWT_SECRET: secret,
  CLOUDINARY_CLOUD_NAME: on ? "nouri-cloud" : undefined,
  CLOUDINARY_API_KEY: on ? "key" : undefined,
  CLOUDINARY_API_SECRET: on ? "secret" : undefined,
});

let photo: Buffer;
const png = () => sharp({ create: { width: 8, height: 8, channels: 3, background: "#123" } }).png().toBuffer();
const formWith = (files: Array<{ bytes: Buffer; name?: string; type?: string }>, fields: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  for (const file of files) data.append("images", new Blob([new Uint8Array(file.bytes)], { type: file.type ?? "image/jpeg" }), file.name ?? "anh.jpg");
  return data;
};

beforeEach(async () => {
  vi.resetAllMocks();
  configure(true);
  photo ??= await jpegWithGps(64, 32, 6);
  mocks.uploadedBuffers.length = 0;
  let counter = 0;
  mocks.uploadStream.mockImplementation((_options, callback) => ({
    end: (buffer: Buffer) => {
      mocks.uploadedBuffers.push(buffer);
      counter += 1;
      callback(undefined, { secure_url: `https://res.cloudinary.com/nouri-cloud/image/upload/v1/nouri/posts/p${counter}.jpg`, public_id: `nouri/posts/p${counter}` });
    },
  }));
  mocks.destroy.mockResolvedValue({ result: "ok" });
  mocks.createPost.mockImplementation(async ({ data }) => ({
    id: postId, authorId: userId, content: data.content, recipeId: null, recipe: null, author: { id: userId, name: "Minh Anh" },
    images: (data.images?.create ?? []).map(({ url, position }: { url: string; position: number }) => ({ url, position })),
    createdAt: new Date(), updatedAt: new Date(),
  }));
  mocks.transaction.mockImplementation(async (operation: unknown) => Promise.all(operation as Promise<unknown>[]));
  mocks.deleteNotifications.mockResolvedValue({ count: 0 });
  mocks.deletePost.mockResolvedValue({ id: postId });
});

describe("Posting with images (multipart)", () => {
  it("uploads to nouri/posts without EXIF/GPS, then creates the post with images in order", async () => {
    const response = await request(app, "/api/community", {
      method: "POST", token: token(), form: formWith([{ bytes: photo }, { bytes: await png(), name: "b.png", type: "image/png" }], { content: "Bữa trưa" }),
    });
    expect(response.status).toBe(201);
    expect(response.body.images).toEqual([
      { url: "https://res.cloudinary.com/nouri-cloud/image/upload/v1/nouri/posts/p1.jpg", position: 0 },
      { url: "https://res.cloudinary.com/nouri-cloud/image/upload/v1/nouri/posts/p2.jpg", position: 1 },
    ]);
    expect(mocks.uploadStream.mock.calls.every(([options]) => options.folder === "nouri/posts")).toBe(true);
    const sent = await sharp(mocks.uploadedBuffers[0]).metadata();
    expect(sent.exif).toBeUndefined();
    expect(exifHasGps(sent.exif)).toBe(false);
    expect(sent).toMatchObject({ width: 32, height: 64 });
    expect(mocks.createPost.mock.calls[0][0].data).toMatchObject({
      authorId: userId, content: "Bữa trưa",
      images: { create: [{ publicId: "nouri/posts/p1", position: 0 }, { publicId: "nouri/posts/p2", position: 1 }] },
    });
  });

  it("allows a post with only images (no text, no recipe)", async () => {
    const response = await request(app, "/api/community", { method: "POST", token: token(), form: formWith([{ bytes: photo }]) });
    expect(response.status).toBe(201);
    expect(mocks.createPost.mock.calls[0][0].data.content).toBe("");
  });

  it("still accepts the old JSON body without images", async () => {
    const response = await request(app, "/api/community", { method: "POST", token: token(), body: { content: "Chỉ có chữ" } });
    expect(response.status).toBe(201);
    expect(response.body.images).toEqual([]);
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("rejects a post with nothing at all (no text, recipe or image)", async () => {
    expect(await request(app, "/api/community", { method: "POST", token: token(), form: formWith([], { content: "   " }) }))
      .toEqual({ status: 422, body: { message: "Bài viết cần có nội dung, công thức hoặc ảnh." } });
  });

  it("rejects more than 4 images with 422 before uploading", async () => {
    const files = Array.from({ length: 5 }, () => ({ bytes: photo }));
    expect(await request(app, "/api/community", { method: "POST", token: token(), form: formWith(files, { content: "Nhiều ảnh" }) }))
      .toEqual({ status: 422, body: { message: "Mỗi bài tối đa 4 ảnh." } });
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("rejects a wrong format (checked by file signature) and an image over 5 MB", async () => {
    const fake = await request(app, "/api/community", {
      method: "POST", token: token(), form: formWith([{ bytes: Buffer.from("khong phai anh"), name: "anh.jpg" }], { content: "x" }),
    });
    expect(fake).toEqual({ status: 422, body: { message: "Chỉ nhận ảnh JPG, PNG hoặc WEBP." } });
    const big = await request(app, "/api/community", {
      method: "POST", token: token(), form: formWith([{ bytes: Buffer.concat([photo, Buffer.alloc(5 * 1024 * 1024)]) }], { content: "x" }),
    });
    expect(big).toEqual({ status: 422, body: { message: "Ảnh vượt quá 5 MB." } });
    expect(mocks.createPost).not.toHaveBeenCalled();
  });

  it("returns 503 for a post with images when Cloudinary is not configured, but text-only posts still work", async () => {
    configure(false);
    expect(await request(app, "/api/community", { method: "POST", token: token(), form: formWith([{ bytes: photo }], { content: "x" }) }))
      .toEqual({ status: 503, body: { message: "Chức năng tải ảnh chưa được cấu hình." } });
    expect((await request(app, "/api/community", { method: "POST", token: token(), body: { content: "Không ảnh" } })).status).toBe(201);
    expect((await request(app, "/api/community", { method: "POST", token: token(), form: formWith([], { content: "Không ảnh" }) })).status).toBe(201);
  });

  it("deletes every uploaded image when creating the post fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createPost.mockRejectedValue(new Error("database unavailable"));
    const response = await request(app, "/api/community", {
      method: "POST", token: token(), form: formWith([{ bytes: photo }, { bytes: photo }], { content: "x" }),
    });
    expect(response.status).toBe(500);
    expect(mocks.destroy.mock.calls.map(([id]) => id)).toEqual(["nouri/posts/p1", "nouri/posts/p2"]);
  });

  it("deletes the images already uploaded when a later upload fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.uploadStream
      .mockImplementationOnce((_options, callback) => ({ end: () => callback(undefined, { secure_url: "https://x/1.jpg", public_id: "nouri/posts/ok" }) }))
      .mockImplementationOnce((_options, callback) => ({ end: () => callback(new Error("network")) }));
    const response = await request(app, "/api/community", {
      method: "POST", token: token(), form: formWith([{ bytes: photo }, { bytes: photo }], { content: "x" }),
    });
    expect(response.status).toBe(502);
    expect(mocks.destroy).toHaveBeenCalledWith("nouri/posts/ok", { resource_type: "image", invalidate: true });
    expect(mocks.createPost).not.toHaveBeenCalled();
  });
});

describe("Deleting a post with images", () => {
  it("deletes the images on Cloudinary after the post is deleted", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: userId, images: [{ publicId: "nouri/posts/a" }, { publicId: "nouri/posts/b" }] });
    expect((await request(app, `/api/community/${postId}`, { method: "DELETE", token: token() })).status).toBe(204);
    expect(mocks.destroy.mock.calls.map(([id]) => id)).toEqual(["nouri/posts/a", "nouri/posts/b"]);
    expect(mocks.deletePost.mock.invocationCallOrder[0]).toBeLessThan(mocks.destroy.mock.invocationCallOrder[0]);
  });

  it("keeps the post deleted even if removing an image from Cloudinary fails (only logged)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findPost.mockResolvedValue({ id: postId, authorId: userId, images: [{ publicId: "nouri/posts/a" }] });
    mocks.destroy.mockRejectedValue(new Error("network"));
    expect((await request(app, `/api/community/${postId}`, { method: "DELETE", token: token() })).status).toBe(204);
    expect(log).toHaveBeenCalled();
  });

  it("does not touch Cloudinary when the post is someone else's", async () => {
    mocks.findPost.mockResolvedValue({ id: postId, authorId: "someone-else", images: [{ publicId: "nouri/posts/a" }] });
    expect((await request(app, `/api/community/${postId}`, { method: "DELETE", token: token() })).status).toBe(404);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
});
