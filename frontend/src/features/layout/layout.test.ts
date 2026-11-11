import { describe, expect, it } from "vitest";
import { accountMenuItems, adminRedirect, FOOTER_GROUPS, isAdmin, isRecipePreviewPath, postLoginPath, PRIMARY_NAV, userInitial } from "./layout.logic";

describe("account menu", () => {
  it("shows Quản trị only to an ADMIN account", () => {
    expect(accountMenuItems({ role: "USER" }).map((item) => item.label)).toEqual(["Hồ sơ", "Đăng xuất"]);
    expect(accountMenuItems(null).map((item) => item.label)).toEqual(["Hồ sơ", "Đăng xuất"]);
    expect(accountMenuItems({ role: "ADMIN" })).toEqual([
      { kind: "link", to: "/profile", label: "Hồ sơ" },
      { kind: "link", to: "/admin", label: "Quản trị" },
      { kind: "logout", label: "Đăng xuất" },
    ]);
  });

  it("treats a session saved before roles existed (no role) as a normal user", () => {
    expect(isAdmin({})).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
  });
});

describe("userInitial", () => {
  it("uses the first letter of the name, uppercased (Vietnamese aware)", () => {
    expect(userInitial("minh Anh")).toBe("M");
    expect(userInitial("  đức")).toBe("Đ");
    expect(userInitial("")).toBe("N");
    expect(userInitial(undefined)).toBe("N");
  });
});

describe("navigation data", () => {
  it("keeps Hồ sơ out of the main menu (it lives in the account menu)", () => {
    expect(PRIMARY_NAV.map((link) => link.to)).toEqual(["/dashboard", "/pantry", "/meal-plans", "/recipes", "/community", "/assistant"]);
  });

  it("links the footer only to pages that exist", () => {
    const routes = new Set(["/dashboard", "/pantry", "/meal-plans", "/recipes", "/community", "/assistant", "/profile", "/privacy", "/terms"]);
    const links = FOOTER_GROUPS.flatMap((group) => group.links.map((link) => link.to));
    expect(links.filter((to) => !routes.has(to))).toEqual([]);
  });
});

describe("separate Admin area", () => {
  const admin = { role: "ADMIN" };
  const user = { role: "USER" };

  it("sends ADMIN from any user page to /admin, except the recipe preview", () => {
    for (const path of ["/dashboard", "/pantry", "/meal-plans/abc", "/recipes", "/community", "/assistant", "/profile"]) {
      expect(adminRedirect(admin, path)).toBe("/admin");
    }
    expect(adminRedirect(admin, "/recipes/cmvtmoi9d000pmx4nzgy6fkxr")).toBeNull();
    expect(adminRedirect(admin, "/recipes/abc/")).toBeNull();
    expect(isRecipePreviewPath("/recipes/abc/edit")).toBe(false);
  });

  it("never redirects a normal user or a signed-out visitor", () => {
    expect(adminRedirect(user, "/pantry")).toBeNull();
    expect(adminRedirect(null, "/pantry")).toBeNull();
    expect(adminRedirect({}, "/dashboard")).toBeNull();
  });

  it("opens /admin after an ADMIN signs in, even when next points to a user page", () => {
    expect(postLoginPath(admin, "/dashboard")).toBe("/admin");
    expect(postLoginPath(admin, "/pantry")).toBe("/admin");
    expect(postLoginPath(admin, "/admin/users")).toBe("/admin/users");
    expect(postLoginPath(admin, "/recipes/abc")).toBe("/recipes/abc");
    expect(postLoginPath(admin, "/administrator")).toBe("/admin");
  });

  it("keeps next for a normal user but never sends them into the Admin area", () => {
    expect(postLoginPath(user, "/recipes/abc")).toBe("/recipes/abc");
    expect(postLoginPath(user, "/dashboard")).toBe("/dashboard");
    expect(postLoginPath(user, "/admin")).toBe("/dashboard");
    expect(postLoginPath(user, "/admin/users")).toBe("/dashboard");
    expect(postLoginPath(undefined, "/pantry")).toBe("/pantry");
  });
});
