import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountStatus } from "../../services/account-status.service.js";
import { request, testApp } from "../../test/http-test-utils.js";
import adminRoutes from "./admin.routes.js";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  findUnique: vi.fn(), update: vi.fn(),
  uploadStream: vi.fn(), destroy: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: mocks.env }));
vi.mock("../../lib/prisma.js", () => ({ prisma: { recipe: { findUnique: mocks.findUnique, update: mocks.update } } }));
vi.mock("cloudinary", () => ({ v2: { config: vi.fn(), uploader: { upload_stream: mocks.uploadStream, destroy: mocks.destroy } } }));

const secret = "nouri-test-only-secret-at-least-32-characters";
const app = testApp("/api/admin", adminRoutes);
const adminId = "cm11111111111111111111111";
const recipeId = "cm22222222222222222222222";
const path = `/api/admin/recipes/${recipeId}/image`;
const token = () => `Bearer ${jwt.sign({ sub: adminId, email: "admin@nouri.vn" }, secret)}`;
const accountStatus = vi.mocked(getAccountStatus);
const cloudUrl = (id: string) => `https://res.cloudinary.com/nouri-cloud/image/upload/v1/${id}.jpg`;

const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const form = (bytes: Buffer, name = "mon-an.jpg", type = "image/jpeg") => {
  const data = new FormData();
  data.append("image", new Blob([new Uint8Array(bytes)], { type }), name);
  return data;
};
const configure = (on: boolean) => Object.assign(mocks.env, {
  JWT_SECRET: secret,
  CLOUDINARY_CLOUD_NAME: on ? "nouri-cloud" : undefined,
  CLOUDINARY_API_KEY: on ? "key" : undefined,
  CLOUDINARY_API_SECRET: on ? "secret" : undefined,
});

beforeEach(() => {
  vi.resetAllMocks();
  configure(true);
  accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: null });
  mocks.findUnique.mockResolvedValue({ id: recipeId, imagePublicId: "nouri/recipes/old" });
  mocks.update.mockImplementation(async ({ data }) => ({ id: recipeId, ...data }));
  mocks.uploadStream.mockImplementation((_options, callback) => ({
    end: () => callback(undefined, { secure_url: cloudUrl("nouri/recipes/new"), public_id: "nouri/recipes/new" }),
  }));
  mocks.destroy.mockResolvedValue({ result: "ok" });
});

describe("PUT /api/admin/recipes/:id/image permissions", () => {
  it("401 without login, 403 for USER and for a locked admin, without uploading", async () => {
    expect((await request(app, path, { method: "PUT", form: form(jpg) })).status).toBe(401);
    accountStatus.mockResolvedValue({ role: "USER", lockedAt: null });
    expect((await request(app, path, { method: "PUT", form: form(jpg), token: token() })).status).toBe(403);
    accountStatus.mockResolvedValue({ role: "ADMIN", lockedAt: new Date() });
    const locked = await request(app, path, { method: "PUT", form: form(jpg), token: token() });
    expect(locked.status).toBe(403);
    expect(locked.body.details).toEqual({ code: "ACCOUNT_LOCKED" });
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("200 for an ADMIN: uploads to nouri/recipes, saves URL + publicId, then deletes the old image", async () => {
    const response = await request(app, path, { method: "PUT", form: form(jpg), token: token() });
    expect(response).toEqual({ status: 200, body: { id: recipeId, imageUrl: cloudUrl("nouri/recipes/new"), imagePublicId: "nouri/recipes/new" } });
    expect(mocks.uploadStream.mock.calls[0][0]).toMatchObject({ folder: "nouri/recipes" });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: recipeId }, data: { imageUrl: cloudUrl("nouri/recipes/new"), imagePublicId: "nouri/recipes/new" },
    }));
    expect(mocks.destroy).toHaveBeenCalledWith("nouri/recipes/old", { resource_type: "image", invalidate: true });
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.destroy.mock.invocationCallOrder[0]);
  });

  it("does not try to delete anything when the recipe still used a group image (/assets)", async () => {
    mocks.findUnique.mockResolvedValue({ id: recipeId, imagePublicId: null });
    expect((await request(app, path, { method: "PUT", form: form(jpg), token: token() })).status).toBe(200);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
});

describe("Image upload validation", () => {
  it("returns 503 when Cloudinary is not configured, before reading the file", async () => {
    configure(false);
    expect(await request(app, path, { method: "PUT", form: form(jpg), token: token() }))
      .toEqual({ status: 503, body: { message: "Chức năng tải ảnh chưa được cấu hình." } });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["a GIF", Buffer.from("GIF89a\x01\x00\x01\x00"), "anh.gif", "image/gif"],
    ["a text file renamed to .jpg with an image/jpeg type", Buffer.from("day khong phai la anh"), "anh.jpg", "image/jpeg"],
  ])("rejects %s with 422 (checked by file signature)", async (_name, bytes, name, type) => {
    expect(await request(app, path, { method: "PUT", form: form(bytes, name, type), token: token() }))
      .toEqual({ status: 422, body: { message: "Chỉ nhận ảnh JPG, PNG hoặc WEBP." } });
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("rejects a file over 5 MB with 422", async () => {
    const big = Buffer.concat([jpg, Buffer.alloc(5 * 1024 * 1024)]);
    expect(await request(app, path, { method: "PUT", form: form(big), token: token() }))
      .toEqual({ status: 422, body: { message: "Ảnh vượt quá 5 MB." } });
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("rejects a request without a file (422) and an invalid recipe id (422)", async () => {
    expect(await request(app, path, { method: "PUT", form: new FormData(), token: token() }))
      .toEqual({ status: 422, body: { message: "Chưa chọn ảnh." } });
    expect((await request(app, "/api/admin/recipes/not-a-cuid/image", { method: "PUT", form: form(jpg), token: token() })).status).toBe(422);
  });

  it("returns 404 for a missing recipe without uploading", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect((await request(app, path, { method: "PUT", form: form(jpg), token: token() })).status).toBe(404);
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("deletes the just-uploaded image when saving to the database fails, and keeps the old one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.update.mockRejectedValue(new Error("database unavailable"));
    expect((await request(app, path, { method: "PUT", form: form(jpg), token: token() })).status).toBe(500);
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
    expect(mocks.destroy).toHaveBeenCalledWith("nouri/recipes/new", { resource_type: "image", invalidate: true });
  });

  it("still succeeds when deleting the old image fails (only logged)", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.destroy.mockRejectedValue(new Error("network"));
    expect((await request(app, path, { method: "PUT", form: form(jpg), token: token() })).status).toBe(200);
    expect(log).toHaveBeenCalled();
  });
});

describe("imageUrl on create/update is limited to project images", () => {
  const body = {
    name: "Đậu hũ sốt nấm", description: "Món thử.", instructions: ["Chiên", "Xào"], prepMinutes: 5, cookMinutes: 10,
    calories: 300, proteinG: 10, carbsG: 20, fatG: 10, cuisine: "Việt Nam", dietTags: ["BALANCED"], mealTypes: ["LUNCH"],
    ingredients: [{ name: "Đậu hũ", quantity: 100, unit: "G" }],
  };

  it.each([
    "https://example.com/anh.jpg",
    "https://res.cloudinary.com/another-cloud/image/upload/v1/nouri/recipes/a.jpg",
  ])("rejects %s with 422", async (imageUrl) => {
    const response = await request(app, `/api/admin/recipes/${recipeId}`, { method: "PUT", token: token(), body: { ...body, imageUrl } });
    expect(response.status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("accepts a project Cloudinary image and an /assets group image", async () => {
    mocks.findUnique.mockResolvedValue({ id: recipeId, imageUrl: cloudUrl("nouri/recipes/new"), imagePublicId: "nouri/recipes/new" });
    for (const imageUrl of [cloudUrl("nouri/recipes/new"), "/assets/recipe-oats.jpg"]) {
      expect((await request(app, `/api/admin/recipes/${recipeId}`, { method: "PUT", token: token(), body: { ...body, imageUrl } })).status).toBe(200);
    }
  });

  it("switching back to a group image unlinks and deletes the uploaded image", async () => {
    mocks.findUnique.mockResolvedValue({ id: recipeId, imageUrl: cloudUrl("nouri/recipes/new"), imagePublicId: "nouri/recipes/new" });
    await request(app, `/api/admin/recipes/${recipeId}`, { method: "PUT", token: token(), body: { ...body, imageUrl: "/assets/recipe-oats.jpg" } });
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ imageUrl: "/assets/recipe-oats.jpg", imagePublicId: null });
    expect(mocks.destroy).toHaveBeenCalledWith("nouri/recipes/new", { resource_type: "image", invalidate: true });
  });
});
