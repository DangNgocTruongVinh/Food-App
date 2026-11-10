import { describe, expect, it } from "vitest";
import type { FeaturedRecipe, RecipeStats } from "../../types";
import { loginPath, safeNextPath } from "../auth/auth.logic";
import {
  featuredRecipeFacts, featuredRecipeLink, landingRecipeGroups,
  landingLink, landingRecipeIntro,
} from "./landing.logic";
import { LANDING_COMMUNITY, LANDING_FEATURES, LANDING_SECTIONS, LANDING_STEPS } from "./landing.data";

const stats: RecipeStats = { total: 33, breakfast: 9, vegetarian: 17, vegan: 10, lowCarb: 4, highProtein: 12 };
const recipe = (id: string, imageUrl: string | null, extra: Partial<FeaturedRecipe> = {}): FeaturedRecipe => ({
  id, slug: id, name: `Món ${id}`, imageUrl, calories: 420, prepMinutes: 10, cookMinutes: 25, dietTags: ["BALANCED"], mealTypes: ["LUNCH"], ...extra,
});

describe("Landing recipe numbers come from the public stats API", () => {
  it("shows the real count of each group, including a real zero", () => {
    expect(landingRecipeGroups(stats).map((group) => [group.label, group.count])).toEqual([
      ["Bữa sáng", 9], ["Món chay", 17], ["Thuần chay", 10], ["Ít tinh bột", 4], ["Giàu đạm", 12],
    ]);
    expect(landingRecipeGroups({ ...stats, lowCarb: 0 }).find((group) => group.key === "lowCarb")?.count).toBe(0);
  });

  it("hides every number while stats are missing", () => {
    expect(landingRecipeGroups(undefined)).toEqual([]);
    expect(landingRecipeIntro(undefined)).not.toMatch(/\d/);
    expect(landingRecipeIntro(stats)).toContain("Nouri đang có 33 món");
  });
});

describe("Featured recipes on the Landing page", () => {
  it("sends guests to sign in first and back to the recipe; signed-in users open it directly", () => {
    expect(featuredRecipeLink({ id: "abc" }, false)).toBe("/login?next=%2Frecipes%2Fabc");
    expect(featuredRecipeLink({ id: "abc" }, true)).toBe("/recipes/abc");
  });

  it("lists time, calories, the first meal and a Vietnamese diet label (not Cân bằng)", () => {
    expect(featuredRecipeFacts(recipe("a", null, { dietTags: ["BALANCED", "HIGH_PROTEIN"], mealTypes: ["DINNER", "LUNCH"] })))
      .toEqual({ minutes: 35, calories: 420, tags: ["Bữa tối", "Giàu đạm"] });
    expect(featuredRecipeFacts(recipe("b", null)).tags).toEqual(["Bữa trưa"]);
  });
});

describe("Landing copy", () => {
  it("has 5 features pointing at real pages, 4 ordered steps (kho, hồ sơ, thực đơn, đi chợ) and anchors for every section", () => {
    expect(LANDING_FEATURES.map((feature) => feature.path)).toEqual(["/pantry", "/meal-plans", "/recipes", "/community", "/assistant"]);
    expect(LANDING_STEPS.map((step) => step.title)).toEqual(["Nhập thực phẩm vào kho", "Điền hồ sơ ăn uống", "Tạo thực đơn 7 ngày", "Đi chợ theo danh sách"]);
    expect(LANDING_SECTIONS.map((section) => section.id)).toEqual(["nouri-giup-gi", "mon-an", "cach-hoat-dong", "cong-dong"]);
  });

  it("contains no made-up figures, hype words or English labels", () => {
    const text = [
      ...LANDING_FEATURES.flatMap((item) => [item.title, item.body, item.extra ?? "", item.action]), ...LANDING_STEPS.flatMap((item) => [item.title, item.body]), ...LANDING_COMMUNITY,
    ].join(" ");
    expect(text).not.toMatch(/thành viên|\d+[.,]\d{3}|\d+K\+|tuyệt vời|thông minh|hành trình|khám phá|healthy|eat clean|low carb/i);
  });
});

describe("Links from the Landing page to app pages", () => {
  it("send guests through sign-in back to the page, and signed-in users straight there", () => {
    expect(landingLink("/pantry", false)).toBe("/login?next=%2Fpantry");
    expect(landingLink("/pantry", true)).toBe("/pantry");
  });
});

describe("Login links from the Landing page", () => {
  it("builds /login links for sign-up and for returning to a page", () => {
    expect(loginPath()).toBe("/login");
    expect(loginPath({ mode: "register" })).toBe("/login?mode=register");
    expect(loginPath({ next: "/community" })).toBe("/login?next=%2Fcommunity");
  });

  it("only follows in-app paths after login", () => {
    expect(safeNextPath("/recipes/abc")).toBe("/recipes/abc");
    for (const unsafe of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "recipes", "/login?next=/x"]) {
      expect(safeNextPath(unsafe)).toBe("/dashboard");
    }
  });
});
