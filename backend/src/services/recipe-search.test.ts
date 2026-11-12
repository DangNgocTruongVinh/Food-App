import { describe, expect, it } from "vitest";
import { foldSearchText, parseSearchQuery, searchRecipes } from "./recipe-search.js";

const bibimbap = {
  name: "Cơm trộn Hàn Quốc (bibimbap)", cuisine: "Hàn Quốc", mealTypes: ["LUNCH"], dietTags: ["VEGETARIAN"],
  ingredients: [{ name: "Gạo" }, { name: "Trứng" }, { name: "Cải bó xôi" }],
};
const banhMi = { name: "Bánh mì chay", cuisine: "Việt Nam", mealTypes: ["BREAKFAST"], dietTags: ["VEGAN"], ingredients: [{ name: "Đậu hũ" }, { name: "Bánh mì" }] };
const pho = { name: "Phở bò", cuisine: "Việt Nam", mealTypes: ["BREAKFAST"], dietTags: [], ingredients: [{ name: "Thịt bò" }, { name: "Bánh phở" }] };
const tofuSoup = { name: "Canh đậu hũ cà chua", cuisine: "Việt Nam", mealTypes: ["DINNER"], dietTags: ["VEGAN"], ingredients: [{ name: "Đậu hũ" }] };
const friedChicken = { name: "Gà chiên giòn", cuisine: "Hàn Quốc", mealTypes: ["DINNER"], dietTags: [], ingredients: [{ name: "Bột chiên giòn" }] };
const all = [bibimbap, banhMi, pho, tofuSoup, friedChicken];
const names = (query: string) => searchRecipes(all, query).map((recipe) => recipe.name);

describe("searchRecipes (dùng chung mọi ô tìm món)", () => {
  it("bỏ dấu, không phân biệt hoa thường", () => {
    expect(foldSearchText("  Cơm   TRỘN  Đậu ")).toBe("com tron dau");
    expect(names("com tron")).toEqual(["Cơm trộn Hàn Quốc (bibimbap)"]);
    expect(names("PHO BO")).toEqual(["Phở bò"]);
  });

  it("đảo thứ tự từ, gõ dở từ cuối", () => {
    expect(names("han quoc com")).toEqual(["Cơm trộn Hàn Quốc (bibimbap)"]);
    expect(names("tron co")).toEqual([]); // "co" < 3 chữ phải đúng cả từ
    expect(names("bibim")).toEqual(["Cơm trộn Hàn Quốc (bibimbap)"]);
  });

  it("tìm theo nguyên liệu; món khớp tên xếp trước món chỉ khớp nguyên liệu", () => {
    expect(names("đậu hũ")).toEqual(["Canh đậu hũ cà chua", "Bánh mì chay"]);
  });

  it("tìm theo ẩm thực, loại bữa, chế độ ăn và từ đồng nghĩa", () => {
    expect(names("korea")).toEqual(["Cơm trộn Hàn Quốc (bibimbap)", "Gà chiên giòn"]);
    expect(names("hàn")).toEqual(names("hàn quốc"));
    expect(names("bữa sáng")).toEqual(["Bánh mì chay", "Phở bò"]);
    expect(names("thuần chay")).toEqual(["Bánh mì chay", "Cơm trộn Hàn Quốc (bibimbap)", "Canh đậu hũ cà chua"]);
    expect(names("thịt bò")).toEqual(["Phở bò"]);
    expect(names("tofu")).toEqual(["Canh đậu hũ cà chua", "Bánh mì chay"]);
  });

  it("từ ngắn không khớp giữa từ khác ('bò' không ra 'bột')", () => {
    expect(names("bo")).toEqual(["Phở bò", "Cơm trộn Hàn Quốc (bibimbap)"]); // gõ không dấu: "bó xôi" cũng là "bo"
    expect(names("bò")).toEqual(["Phở bò"]); // gõ có dấu: so có dấu
    expect(names("chiên bo")).toEqual([]);
  });

  it("câu tìm trống trả nguyên danh sách; ghép cụm đồng nghĩa dài nhất", () => {
    expect(searchRecipes(all, "  ")).toBe(all);
    expect(parseSearchQuery("thịt bò han quoc")).toEqual([
      { accented: true, phrases: ["bò", "thịt bò", "beef"] },
      { accented: false, phrases: ["han quoc", "han", "korea", "korean"] },
    ]);
  });
});
