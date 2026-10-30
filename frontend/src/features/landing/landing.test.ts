import { describe, expect, it } from "vitest";
import type { RecipeStats } from "../../types";
import { landingCategoryCountLabel, landingRecipeCategoryStats } from "./landing.logic";

const stats: RecipeStats = { total: 33, breakfast: 9, vegetarian: 17, vegan: 10, lowCarb: 4, highProtein: 12 };

describe("Landing recipe categories", () => {
  it("shows the real count of each group", () => {
    expect(landingCategoryCountLabel(stats, "all")).toBe("33 món");
    expect(landingCategoryCountLabel(stats, "breakfast")).toBe("9 món");
    expect(landingCategoryCountLabel(stats, "vegetarian")).toBe("17 món");
    expect(landingCategoryCountLabel(stats, "vegan")).toBe("10 món");
    expect(landingCategoryCountLabel(stats, "low-carb")).toBe("4 món");
    expect(landingCategoryCountLabel(stats, "protein")).toBe("12 món");
  });

  it("hides the count while stats are missing, and still shows a real zero", () => {
    expect(landingCategoryCountLabel(undefined, "all")).toBeNull();
    expect(landingCategoryCountLabel({ ...stats, lowCarb: 0 }, "low-carb")).toBe("0 món");
  });

  it("only uses groups that exist in the recipe data (no placeholder groups)", () => {
    expect(Object.keys(landingRecipeCategoryStats)).toEqual(["all", "breakfast", "vegetarian", "vegan", "low-carb", "protein"]);
  });
});
