import { describe, expect, it } from "vitest";
import { nextAvailableSlug, slugifyVietnamese } from "./slug.js";

describe("slugifyVietnamese", () => {
  it.each([
    ["Cá kho tộ (kèm cơm)", "ca-kho-to-kem-com"],
    ["Đậu hũ sốt cà chua", "dau-hu-sot-ca-chua"],
    ["  Bún bò   Huế!! ", "bun-bo-hue"],
    ["Phở gà đặc biệt – số 1", "pho-ga-dac-biet-so-1"],
    ["Ỗ ặ ữ ợ ẫ", "o-a-u-o-a"],
    ["???", "mon-an"],
  ])("%s → %s", (name, slug) => {
    expect(slugifyVietnamese(name)).toBe(slug);
  });

  it("keeps the slug short without a trailing dash", () => {
    const slug = slugifyVietnamese(`${"canh ".repeat(30)}chua`, 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("nextAvailableSlug", () => {
  it("adds the first free numeric suffix when the slug is taken", () => {
    expect(nextAvailableSlug("ca-kho-to", [])).toBe("ca-kho-to");
    expect(nextAvailableSlug("ca-kho-to", ["ca-kho-to"])).toBe("ca-kho-to-2");
    expect(nextAvailableSlug("ca-kho-to", ["ca-kho-to", "ca-kho-to-2", "ca-kho-to-3"])).toBe("ca-kho-to-4");
    expect(nextAvailableSlug("ca-kho-to", ["ca-kho-to", "ca-kho-to-3"])).toBe("ca-kho-to-2");
  });
});
