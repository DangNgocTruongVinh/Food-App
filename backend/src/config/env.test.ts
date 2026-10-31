import { beforeAll, describe, expect, it, vi } from "vitest";

let envSchema: typeof import("./env.js").envSchema;
const base = { DATABASE_URL: "postgresql://test", JWT_SECRET: "nouri-test-only-secret-at-least-32-characters" };

beforeAll(async () => {
  // env.ts kiểm tra process.env ngay khi import: cung cấp biến bắt buộc giả cho lần import này.
  vi.stubEnv("DATABASE_URL", base.DATABASE_URL);
  vi.stubEnv("JWT_SECRET", base.JWT_SECRET);
  ({ envSchema } = await import("./env.js"));
  vi.unstubAllEnvs();
});

describe("Cloudinary environment (all three or none)", () => {
  it("accepts no Cloudinary variable, or empty values passed by docker compose", () => {
    expect(envSchema.parse(base).CLOUDINARY_CLOUD_NAME).toBeUndefined();
    expect(envSchema.parse({ ...base, CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: " ", CLOUDINARY_API_SECRET: "" }).CLOUDINARY_API_KEY)
      .toBeUndefined();
  });

  it("accepts all three", () => {
    const parsed = envSchema.parse({ ...base, CLOUDINARY_CLOUD_NAME: "nouri", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" });
    expect(parsed.CLOUDINARY_CLOUD_NAME).toBe("nouri");
  });

  it.each([
    [{ CLOUDINARY_CLOUD_NAME: "nouri" }],
    [{ CLOUDINARY_CLOUD_NAME: "nouri", CLOUDINARY_API_KEY: "key" }],
    [{ CLOUDINARY_API_SECRET: "secret" }],
  ])("rejects a partial configuration %#", (partial) => {
    expect(() => envSchema.parse({ ...base, ...partial })).toThrow(/CLOUDINARY_CLOUD_NAME/);
  });
});
