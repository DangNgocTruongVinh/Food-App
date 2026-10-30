import { describe, expect, it } from "vitest";
import { shouldScrollToTop } from "./navigation";

describe("shouldScrollToTop", () => {
  it.each([
    ["/recipes", "/recipes/recipe-a"],
    ["/recipes/recipe-a", "/recipes/recipe-b"],
    ["/dashboard", "/pantry"],
    ["/meal-plans/plan-a", "/recipes/recipe-a"],
    ["/login", "/dashboard"],
  ])("scrolls to the top when moving from %s to %s", (from, to) => {
    expect(shouldScrollToTop(from, to, "PUSH")).toBe(true);
  });

  it("does not scroll on the first render or when only the query string changes (same pathname)", () => {
    expect(shouldScrollToTop(null, "/dashboard", "POP")).toBe(false);
    expect(shouldScrollToTop("/pantry", "/pantry", "REPLACE")).toBe(false);
  });

  it("leaves Back/Forward to the browser", () => {
    expect(shouldScrollToTop("/recipes/recipe-a", "/recipes", "POP")).toBe(false);
  });

  it("keeps the position when switching plans inside the meal plans page", () => {
    expect(shouldScrollToTop("/meal-plans/plan-a", "/meal-plans/plan-b", "PUSH")).toBe(false);
    expect(shouldScrollToTop("/meal-plans", "/meal-plans/plan-a", "REPLACE")).toBe(false);
  });
});
