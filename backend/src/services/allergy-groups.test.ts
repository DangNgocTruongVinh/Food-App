import { describe, expect, it } from "vitest";
import { foldAllergyText, groupsOfFoodName, resolveRestriction, stripFillerWords, suggestAllergyGroup } from "./allergy-groups.js";

const groupIds = (raw: string, strict = true) => resolveRestriction(raw, { strict }).groups.map((group) => group.id);

describe("resolveRestriction: người dùng gõ kiểu gì cũng ra đúng nhóm", () => {
  it.each([
    ["trứng gà", ["EGG"]], ["Trứng Gà", ["EGG"]], ["trung ga", ["EGG"]], ["dị ứng trứng", ["EGG"]], ["bị dị ứng với trứng", ["EGG"]],
    ["egg", ["EGG"]], ["lòng đỏ", ["EGG"]], ["cá hồi", ["FISH"]], ["tôm sú", ["CRUSTACEAN"]], ["lạc", ["PEANUT"]],
    ["đậu phộng", ["PEANUT"]], ["sữa bò", ["MILK"]], ["sữa đậu nành", ["SOY"]], ["mè", ["SESAME"]], ["vừng", ["SESAME"]],
    ["Hải sản", ["FISH", "CRUSTACEAN", "MOLLUSC"]], ["hai san", ["FISH", "CRUSTACEAN", "MOLLUSC"]], ["óc chó", ["TREE_NUT"]],
  ])("%s → %j", (raw, ids) => {
    expect(groupIds(raw)).toEqual(ids);
    expect(resolveRestriction(raw).text).toBeNull();
  });

  it("không nhận ra thì giữ đúng chữ để lọc (không bao giờ bỏ qua)", () => {
    expect(resolveRestriction("Cần tây")).toEqual({ input: "Cần tây", groups: [], text: "cần tây" });
    expect(resolveRestriction("dị ứng nấm").text).toBe("nấm");
  });

  it("món không thích: tên nhóm vẫn là cả nhóm, nhưng tên một nguyên liệu chỉ là chữ đó", () => {
    expect(groupIds("Trứng", false)).toEqual(["EGG"]);
    expect(groupIds("cá hồi", false)).toEqual([]);
    expect(resolveRestriction("cá hồi", { strict: false }).text).toBe("cá hồi");
  });

  it("bỏ từ thừa, bỏ dấu giữ nguyên độ dài", () => {
    expect(stripFillerWords("Bị dị ứng với món Tôm")).toBe("tôm");
    expect(foldAllergyText("Trứng Gà")).toBe("trung ga");
    expect(foldAllergyText("Đậu phộng").length).toBe("Đậu phộng".length);
  });
});

describe("groupsOfFoodName: nhóm của tên nguyên liệu, có ngoại lệ", () => {
  const labels = (name: string) => groupsOfFoodName(name).map((group) => group.label);
  it.each([
    ["Trứng", ["Trứng"]], ["Bánh mì ốp la", ["Gluten"]], ["Sữa tươi", ["Sữa"]], ["Sữa đậu nành", ["Đậu nành"]], ["Bơ lạt", ["Sữa"]],
    ["Quả bơ", []], ["Cà chua", []], ["Cá basa", ["Cá"]], ["Nước mắm", ["Cá"]], ["Tôm", ["Giáp xác"]], ["Dầu mè", ["Mè"]],
    ["Cháo gà hành gừng", []], ["Bánh quốc", []], ["Đậu hũ", ["Đậu nành"]], ["Sữa hạnh nhân", ["Hạt cây"]],
  ])("%s → %j", (name, expected) => expect(labels(name)).toEqual(expected));
});

describe("suggestAllergyGroup: gần đúng chỉ để hỏi lại", () => {
  it("gợi ý khi sai 1–2 ký tự, không gợi ý khi đã nhận ra hoặc quá xa", () => {
    expect(suggestAllergyGroup("trungg")?.label).toBe("Trứng");
    expect(suggestAllergyGroup("dau phong")).toBeNull(); // đã nhận ra (Đậu phộng), không cần hỏi
    expect(suggestAllergyGroup("dau phongg")?.label).toBe("Đậu phộng");
    expect(suggestAllergyGroup("bí đỏ")).toBeNull();
  });
});
