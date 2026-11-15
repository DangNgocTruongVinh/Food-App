import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as limits from "./limits";

// Một nguồn giới hạn cho cả hai phía: giao diện chặn đúng như API kiểm tra (lệch thì giao diện cho qua nhưng API trả 422).
describe("limits dùng chung với backend", () => {
  it("giống hệt backend/src/shared/limits.ts", () => {
    const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
    expect(read("./limits.ts")).toBe(read("../../../../backend/src/shared/limits.ts"));
  });

  it("giữ nguyên các giá trị đã chốt", () => {
    expect(limits.PASSWORD_LIMITS).toEqual({ min: 8, max: 72 });
    expect(limits.PROFILE_LIMITS).toMatchObject({ allergies: 30, dislikedFoods: 30, preferredCuisines: 20, listItemMax: 60 });
    expect(limits.MEMBER_RECIPE_LIMITS).toMatchObject({ ingredients: 30, steps: 20, step: 500 });
    expect([limits.COMMUNITY_POST_MAX_LENGTH, limits.COMMUNITY_COMMENT_MAX_LENGTH]).toEqual([2000, 500]);
    expect(limits.RECIPE_LIMITS).toMatchObject({ name: [2, 120], ingredients: [1, 40], steps: [1, 20], ingredientQuantityMax: 100_000 });
    expect([limits.MAX_IMAGE_BYTES, limits.MAX_POST_IMAGES, limits.EXPIRING_SOON_DAYS]).toEqual([5 * 1024 * 1024, 4, 3]);
  });
});
