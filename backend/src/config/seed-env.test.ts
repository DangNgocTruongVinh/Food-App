import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demoResetPassword, readSeedEnv } from "./seed-env.js";

describe("seed environment", () => {
  it("skips the Admin account and keeps recipes untouched by default", () => {
    expect(readSeedEnv({})).toEqual({ admin: null, updateRecipes: false, demo: null });
    expect(readSeedEnv({ ADMIN_EMAIL: " ", ADMIN_PASSWORD: "", SEED_UPDATE_RECIPES: "" })).toEqual({ admin: null, updateRecipes: false, demo: null });
  });

  it("reads the Admin account (email normalized) and the explicit recipe update flag", () => {
    expect(readSeedEnv({ ADMIN_EMAIL: " Admin@Nouri.VN ", ADMIN_PASSWORD: "Mat-khau-dai-1", SEED_UPDATE_RECIPES: "true" }))
      .toEqual({ admin: { email: "admin@nouri.vn", password: "Mat-khau-dai-1" }, updateRecipes: true, demo: null });
  });

  it.each([
    [{ ADMIN_EMAIL: "admin@nouri.vn" }],
    [{ ADMIN_PASSWORD: "Mat-khau-dai-1" }],
    [{ ADMIN_EMAIL: "khong-phai-email", ADMIN_PASSWORD: "Mat-khau-dai-1" }],
    [{ ADMIN_EMAIL: "admin@nouri.vn", ADMIN_PASSWORD: "ngan" }],
    [{ SEED_UPDATE_RECIPES: "yes" }],
    [{ SEED_DEMO: "true" }],
    [{ SEED_DEMO: "true", DEMO_PASSWORD: "ngan" }],
    [{ SEED_DEMO: "yes", DEMO_PASSWORD: "Demo-dai-du-8" }],
  ])("rejects an incomplete or invalid configuration %#", (source) => {
    expect(() => readSeedEnv(source)).toThrow();
  });

  it("does not put the password in validation errors", () => {
    try {
      readSeedEnv({ ADMIN_EMAIL: "admin@nouri.vn", ADMIN_PASSWORD: "ngan" });
    } catch (error) {
      expect(String(error)).not.toContain("ngan\"");
      expect(JSON.stringify(error)).not.toContain("\"ngan\"");
    }
  });
});

// Audit M4: tài khoản demo chỉ khi SEED_DEMO=true, mật khẩu đọc từ DEMO_PASSWORD (không còn hằng trong mã).
describe("tài khoản demo theo SEED_DEMO (audit M4)", () => {
  it("mặc định tắt; DEMO_PASSWORD một mình không bật demo", () => {
    expect(readSeedEnv({ DEMO_PASSWORD: "Demo-dai-du-8" }).demo).toBeNull();
    expect(readSeedEnv({ SEED_DEMO: "false", DEMO_PASSWORD: "Demo-dai-du-8" }).demo).toBeNull();
  });

  it("SEED_DEMO=true: seed tạo demo với mật khẩu trong .env", () => {
    expect(readSeedEnv({ SEED_DEMO: "true", DEMO_PASSWORD: "Demo-dai-du-8" }).demo).toEqual({ password: "Demo-dai-du-8" });
  });

  it("demo:reset từ chối khi SEED_DEMO tắt, chạy khi bật", () => {
    expect(() => demoResetPassword({})).toThrow(/SEED_DEMO đang tắt/);
    expect(() => demoResetPassword({ DEMO_PASSWORD: "Demo-dai-du-8" })).toThrow(/SEED_DEMO đang tắt/);
    expect(demoResetPassword({ SEED_DEMO: "true", DEMO_PASSWORD: "Demo-dai-du-8" })).toBe("Demo-dai-du-8");
  });

  it("không còn mật khẩu demo viết cứng trong mã", () => {
    const source = readFileSync(new URL("../../prisma/demo-account.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/DEMO_PASSWORD\s*=|Demo@123/);
  });
});
