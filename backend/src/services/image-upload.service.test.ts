import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteImageQuietly, IMAGE_FOLDERS, isImageUploadConfigured, isProjectImageUrl, uploadImage } from "./image-upload.service.js";

const mocks = vi.hoisted(() => ({
  env: { CLOUDINARY_CLOUD_NAME: "nouri-cloud", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" } as Record<string, string | undefined>,
  config: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("../config/env.js", () => ({ env: mocks.env }));
vi.mock("cloudinary", () => ({ v2: { config: mocks.config, uploader: { upload_stream: mocks.uploadStream, destroy: mocks.destroy } } }));

const configure = (on: boolean) => {
  for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
    mocks.env[key] = on ? { CLOUDINARY_CLOUD_NAME: "nouri-cloud", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" }[key] : undefined;
  }
};

beforeEach(() => {
  vi.resetAllMocks();
  configure(true);
});

describe("isProjectImageUrl", () => {
  it.each([
    "/assets/recipe-oats.jpg",
    "https://res.cloudinary.com/nouri-cloud/image/upload/v1730000000/nouri/recipes/abc123.jpg",
    "https://res.cloudinary.com/nouri-cloud/image/upload/f_auto,q_auto,w_800/v1/nouri/posts/xyz.webp",
  ])("accepts %s", (url) => {
    expect(isProjectImageUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com/anh.jpg",
    "https://res.cloudinary.com/another-cloud/image/upload/v1/nouri/recipes/abc.jpg",
    "https://res.cloudinary.com/nouri-cloud/image/upload/v1/other-app/abc.jpg",
    "http://res.cloudinary.com/nouri-cloud/image/upload/v1/nouri/recipes/abc.jpg",
    "/assets/../secret.jpg",
    "javascript:alert(1)",
  ])("rejects %s", (url) => {
    expect(isProjectImageUrl(url)).toBe(false);
  });

  it("only accepts /assets images when Cloudinary is not configured", () => {
    configure(false);
    expect(isImageUploadConfigured()).toBe(false);
    expect(isProjectImageUrl("/assets/recipe-oats.jpg")).toBe(true);
    expect(isProjectImageUrl("https://res.cloudinary.com/nouri-cloud/image/upload/v1/nouri/recipes/abc.jpg")).toBe(false);
  });
});

describe("uploadImage / deleteImageQuietly", () => {
  it("uploads into the project folder and returns the secure URL and publicId", async () => {
    mocks.uploadStream.mockImplementation((options, callback) => ({
      end: () => callback(undefined, { secure_url: "https://res.cloudinary.com/nouri-cloud/image/upload/v1/nouri/recipes/a.jpg", public_id: "nouri/recipes/a" }),
    }));
    await expect(uploadImage(Buffer.from("x"), IMAGE_FOLDERS.recipes))
      .resolves.toEqual({ url: "https://res.cloudinary.com/nouri-cloud/image/upload/v1/nouri/recipes/a.jpg", publicId: "nouri/recipes/a" });
    expect(mocks.uploadStream.mock.calls[0][0]).toEqual({ folder: "nouri/recipes", resource_type: "image", overwrite: false });
  });

  it("turns a Cloudinary failure into a 502 without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.uploadStream.mockImplementation((options, callback) => ({ end: () => callback(new Error("api_secret mismatch")) }));
    await expect(uploadImage(Buffer.from("x"), IMAGE_FOLDERS.recipes)).rejects.toMatchObject({ status: 502, message: "Không tải được ảnh lên, vui lòng thử lại." });
  });

  it("refuses with 503 when Cloudinary is not configured", async () => {
    configure(false);
    await expect(uploadImage(Buffer.from("x"), IMAGE_FOLDERS.recipes)).rejects.toMatchObject({ status: 503 });
    expect(mocks.uploadStream).not.toHaveBeenCalled();
  });

  it("deletes quietly: skips empty ids and only logs a failure", async () => {
    await deleteImageQuietly(null);
    expect(mocks.destroy).not.toHaveBeenCalled();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.destroy.mockRejectedValue(new Error("network"));
    await expect(deleteImageQuietly("nouri/recipes/old")).resolves.toBeUndefined();
    expect(mocks.destroy).toHaveBeenCalledWith("nouri/recipes/old", { resource_type: "image", invalidate: true });
    expect(log).toHaveBeenCalled();
  });
});
