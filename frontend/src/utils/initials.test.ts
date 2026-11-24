import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nameInitials } from "./initials";

describe("nameInitials", () => {
  it("lấy chữ đầu của hai từ cuối, viết hoa theo tiếng Việt", () => {
    expect(nameInitials("Người kiểm thử")).toBe("KT");
    expect(nameInitials("  Nguyễn Linh Nhi ")).toBe("LN");
    expect(nameInitials("minh anh")).toBe("MA");
    expect(nameInitials("  đức")).toBe("Đ");
    expect(nameInitials("Nouri")).toBe("N");
  });

  it("tên trống → N", () => {
    expect(nameInitials("")).toBe("N");
    expect(nameInitials("   ")).toBe("N");
    expect(nameInitials(undefined)).toBe("N");
    expect(nameInitials(null)).toBe("N");
  });

  it("thanh trên và Cộng đồng dùng cùng một hàm (không còn hàm riêng)", () => {
    const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
    expect(source("../features/layout/layout.logic.ts")).not.toMatch(/userInitial/);
    expect(source("../features/community/community.logic.ts")).not.toMatch(/communityInitials/);
    for (const file of ["../components/layout/AccountMenu.tsx", "../layouts/AdminLayout.tsx", "../components/community/PostCard.tsx"]) {
      expect(source(file), file).toContain("nameInitials(");
    }
  });
});
