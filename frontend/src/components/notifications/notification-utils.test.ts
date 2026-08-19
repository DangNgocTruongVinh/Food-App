import { describe, expect, it } from "vitest";
import { unreadBadgeLabel } from "./notification-utils";

describe("unreadBadgeLabel", () => {
  it("hides the badge when there are no unread notifications", () => {
    expect(unreadBadgeLabel(0)).toBeNull();
  });

  it("shows counts from one to nine", () => {
    expect(unreadBadgeLabel(1)).toBe("1");
    expect(unreadBadgeLabel(9)).toBe("9");
  });

  it("caps counts greater than nine", () => {
    expect(unreadBadgeLabel(10)).toBe("9+");
    expect(unreadBadgeLabel(99)).toBe("9+");
  });
});
