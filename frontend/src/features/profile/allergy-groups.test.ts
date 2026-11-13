import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { groupsOfFoodName, resolveRestriction } from "./allergy-groups";

// Một danh mục nhóm dị ứng cho cả hai phía: bản frontend phải giống hệt bản gốc ở backend (test chi tiết ở backend).
describe("allergy-groups dùng chung với backend", () => {
  it("giống hệt backend/src/services/allergy-groups.ts", () => {
    const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
    expect(read("./allergy-groups.ts")).toBe(read("../../../../backend/src/services/allergy-groups.ts"));
  });

  it("nhận nhóm như backend (kiểm nhanh vài mục)", () => {
    expect(resolveRestriction("trung ga").groups.map((group) => group.label)).toEqual(["Trứng"]);
    expect(groupsOfFoodName("Sữa đậu nành").map((group) => group.label)).toEqual(["Đậu nành"]);
  });
});
