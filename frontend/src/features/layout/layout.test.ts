import { describe, expect, it } from "vitest";
import { accountMenuItems, FOOTER_GROUPS, isAdmin, isRedesignedRoute, PRIMARY_NAV, userInitial } from "./layout.logic";

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

describe("isRedesignedRoute", () => {
  it("matches a redesigned route and its sub-paths only", () => {
    expect(isRedesignedRoute("/admin")).toBe(true);
    expect(isRedesignedRoute("/admin/recipes")).toBe(true);
    expect(isRedesignedRoute("/administrator")).toBe(false);
    expect(isRedesignedRoute("/pantry")).toBe(false);
  });
});
