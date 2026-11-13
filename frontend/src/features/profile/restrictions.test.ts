import { describe, expect, it } from "vitest";
import { rankOptions } from "../ui/combobox.logic";
import { addRestrictionTag, avoidSummary, restrictionOptions } from "./restrictions.logic";

describe("Hồ sơ: ô Dị ứng / Món không thích", () => {
  const options = restrictionOptions();

  it("gợi ý gồm tên nhóm, tên gọi khác, nguyên liệu; bên phải ghi \"nhóm <tên nhóm>\"", () => {
    const found = rankOptions(options, "trung");
    expect(found[0]).toMatchObject({ label: "Trứng", detail: "nhóm Trứng" });
    expect(found.map((option) => option.label)).toContain("Trứng gà");
    expect(rankOptions(options, "vung")[0]).toMatchObject({ label: "Vừng", detail: "nhóm Mè" });
    expect(rankOptions(options, "lac")[0]).toMatchObject({ detail: "nhóm Đậu phộng" });
  });

  it("dị ứng thuộc nhóm thì lưu tên nhóm; không chọn trùng nhóm", () => {
    expect(addRestrictionTag([], "trung ga", 20, "allergy")).toMatchObject({ tags: ["Trứng"], error: null, notice: null });
    expect(addRestrictionTag(["Trứng"], "lòng đỏ", 20, "allergy")).toMatchObject({ tags: ["Trứng"], error: "Đã có nhóm Trứng trong danh sách." });
    expect(addRestrictionTag(["Hải sản"], "tôm sú", 20, "allergy").error).toBe("Đã có nhóm Giáp xác trong danh sách.");
    expect(addRestrictionTag(["Tôm"], "Hải sản", 20, "allergy").tags).toEqual(["Tôm", "Hải sản"]); // còn Cá, Nhuyễn thể
  });

  it("món không thích: tên một nguyên liệu giữ nguyên chữ (không thành cả nhóm)", () => {
    expect(addRestrictionTag([], "cá hồi", 20, "dislike")).toMatchObject({ tags: ["cá hồi"], notice: expect.stringContaining("chưa nhận ra") });
    expect(addRestrictionTag([], "Trứng", 20, "dislike")).toMatchObject({ tags: ["Trứng"], notice: null });
  });

  it("Enter với từ không có trong gợi ý: vẫn thêm, nhắc lọc theo đúng chữ, gợi ý gần đúng nếu có", () => {
    expect(addRestrictionTag([], "cần tây", 20, "allergy")).toEqual({
      tags: ["cần tây"], error: null, notice: "Nouri chưa nhận ra “cần tây” — sẽ lọc theo đúng chữ này.", suggestion: null,
    });
    expect(addRestrictionTag([], "trungg", 20, "allergy")).toMatchObject({ tags: ["trungg"], suggestion: "Trứng" });
  });

  it("dòng \"Sẽ tránh\" nêu nhóm kèm ví dụ nguyên liệu và chữ tự do; dữ liệu cũ (\"trứng gà\") vẫn hiểu đúng", () => {
    expect(avoidSummary(["trứng gà", "cần tây"], "allergy")).toBe("Sẽ tránh: Trứng (trứng, lòng đỏ, lòng trắng…), “cần tây”");
    expect(avoidSummary([], "allergy")).toBeNull();
  });
});
