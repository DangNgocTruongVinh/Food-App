import { describe, expect, it } from "vitest";
import { readSeedEnv } from "./seed-env.js";

describe("seed environment", () => {
  it("skips the Admin account and keeps recipes untouched by default", () => {
    expect(readSeedEnv({})).toEqual({ admin: null, updateRecipes: false });
    expect(readSeedEnv({ ADMIN_EMAIL: " ", ADMIN_PASSWORD: "", SEED_UPDATE_RECIPES: "" })).toEqual({ admin: null, updateRecipes: false });
  });

  it("reads the Admin account (email normalized) and the explicit recipe update flag", () => {
    expect(readSeedEnv({ ADMIN_EMAIL: " Admin@Nouri.VN ", ADMIN_PASSWORD: "Mat-khau-dai-1", SEED_UPDATE_RECIPES: "true" }))
      .toEqual({ admin: { email: "admin@nouri.vn", password: "Mat-khau-dai-1" }, updateRecipes: true });
  });

  it.each([
    [{ ADMIN_EMAIL: "admin@nouri.vn" }],
    [{ ADMIN_PASSWORD: "Mat-khau-dai-1" }],
    [{ ADMIN_EMAIL: "khong-phai-email", ADMIN_PASSWORD: "Mat-khau-dai-1" }],
    [{ ADMIN_EMAIL: "admin@nouri.vn", ADMIN_PASSWORD: "ngan" }],
    [{ SEED_UPDATE_RECIPES: "yes" }],
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
