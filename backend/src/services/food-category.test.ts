import { describe, expect, it } from "vitest";
import { seedRecipes } from "../../prisma/seed-data.js";
import { FOOD_CATEGORIES, foodCategoryOf, legumeKind, withFoodCategory } from "./food-category.js";

// Nhóm mong đợi của từng tên nguyên liệu trong bộ món seed (rà bằng tay).
const EXPECTED: Record<string, string> = {
  "Bạc hà": "Rau củ", "Bánh mì": "Ngũ cốc", "Bánh phở": "Ngũ cốc", "Bánh tráng": "Ngũ cốc", "Bắp ngọt": "Rau củ", "Bí đỏ": "Rau củ",
  "Bông cải xanh": "Rau củ", "Bún tươi": "Ngũ cốc", "Cá basa": "Thịt & cá", "Cà chua": "Rau củ", "Cá diêu hồng": "Thịt & cá",
  "Cá lóc": "Thịt & cá", "Cà rốt": "Rau củ", "Cải ngọt": "Rau củ", "Cải thìa": "Rau củ", "Chanh": "Trái cây", "Chuối": "Trái cây",
  "Dầu ăn": "Gia vị", "Dầu mè": "Gia vị", "Dầu ô liu": "Gia vị", "Dưa leo": "Rau củ", "Đá viên": "Khác", "Đậu bắp": "Rau củ",
  "Đậu đen": "Đậu & hạt", "Đậu Hà Lan": "Rau củ", "Đậu hũ": "Đậu & hạt", "Đậu nành": "Đậu & hạt", "Đậu phộng": "Đậu & hạt",
  "Đậu xanh": "Đậu & hạt", "Đu đủ xanh": "Rau củ", "Đùi gà": "Thịt & cá", "Đường": "Gia vị", "Gạo": "Ngũ cốc", "Gạo nếp": "Ngũ cốc",
  "Gạo tấm": "Ngũ cốc", "Giá đỗ": "Rau củ", "Giấm": "Gia vị", "Gừng": "Rau củ", "Hành lá": "Rau củ", "Hành tây": "Rau củ",
  "Hành tím": "Rau củ", "Hẹ": "Rau củ", "Hoa hồi": "Gia vị", "Khoai lang": "Rau củ", "Lá dứa": "Rau củ", "Lá oregano khô": "Gia vị",
  "Mật ong": "Gia vị", "Me chua": "Trái cây", "Mè rang": "Gia vị", "Mì Ý": "Ngũ cốc", "Muối": "Gia vị", "Nấm bào ngư": "Rau củ",
  "Nấm đông cô": "Rau củ", "Nấm rơm": "Rau củ", "Nếp cẩm": "Ngũ cốc", "Ngò om": "Rau củ", "Nước cốt dừa": "Trái cây",
  "Nước dừa": "Trái cây", "Nước mắm": "Gia vị", "Nước tương": "Gia vị", "Ô liu đen": "Gia vị", "Ớt": "Rau củ", "Ớt chuông": "Rau củ",
  "Phô mai feta": "Trứng & sữa", "Quả bơ": "Trái cây", "Quế": "Gia vị", "Rau cải bó xôi": "Rau củ", "Rau mùi": "Rau củ",
  "Rau thơm": "Rau củ", "Sả": "Rau củ", "Sữa chua": "Trứng & sữa", "Sữa đặc": "Trứng & sữa", "Sữa tươi": "Trứng & sữa",
  "Sườn heo": "Thịt & cá", "Thịt ba chỉ": "Thịt & cá", "Thịt bò": "Thịt & cá", "Thịt bò xay": "Thịt & cá", "Thịt heo nạc": "Thịt & cá",
  "Thịt heo xay": "Thịt & cá", "Thơm": "Trái cây", "Tiêu": "Gia vị", "Tỏi": "Rau củ", "Tôm": "Thịt & cá", "Trứng": "Trứng & sữa",
  "Tương đen": "Gia vị", "Tương ớt Hàn Quốc": "Gia vị", "Ức gà": "Thịt & cá", "Xà lách": "Rau củ", "Xương ống bò": "Thịt & cá",
  "Yến mạch": "Ngũ cốc",
};

describe("Food categories (8 shared groups)", () => {
  it("classifies every ingredient name of the seed recipes as expected", () => {
    const names = [...new Set(seedRecipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.name)))];
    expect(names.length).toBe(90);
    expect(names.filter((name) => !(name in EXPECTED))).toEqual([]);
    expect(Object.fromEntries(names.map((name) => [name, foodCategoryOf(name)]))).toEqual(Object.fromEntries(names.map((name) => [name, EXPECTED[name]])));
  });

  it("uses only the 8 shared groups and ignores case, extra spaces and decomposed accents", () => {
    expect(new Set(Object.values(EXPECTED)).size).toBeLessThanOrEqual(FOOD_CATEGORIES.length);
    expect(Object.values(EXPECTED).every((category) => (FOOD_CATEGORIES as readonly string[]).includes(category))).toBe(true);
    expect(foodCategoryOf("  ĐẬU   HŨ ")).toBe("Đậu & hạt");
    expect(foodCategoryOf("Cá lóc".normalize("NFD"))).toBe("Thịt & cá");
    expect(foodCategoryOf("Cà tím")).toBe("Rau củ");
    expect(foodCategoryOf("Bún khô")).toBe("Ngũ cốc");
    expect(foodCategoryOf("Bột năng")).toBe("Ngũ cốc");
    expect(foodCategoryOf("Khăn giấy")).toBe("Khác");
  });

  it("tells fresh tofu/beans from dry legumes and nuts (for suggested expiry)", () => {
    for (const name of ["Đậu phộng", "Đậu xanh", "Đậu đen", "Đậu đỏ", "Đậu nành", "Lạc rang", "Hạt điều", "Mè đen"]) expect(legumeKind(name)).toBe("dry");
    for (const name of ["Đậu hũ", "Đậu phụ", "Đậu hũ non", "Tàu hũ ky"]) expect(legumeKind(name)).toBe("fresh");
  });

  it("fills a missing category of an old shopping line when reading, keeps an existing one", () => {
    expect(withFoodCategory({ name: "Đậu hũ", category: null })).toEqual({ name: "Đậu hũ", category: "Đậu & hạt" });
    expect(withFoodCategory({ name: "Đậu hũ", category: "  " })).toEqual({ name: "Đậu hũ", category: "Đậu & hạt" });
    expect(withFoodCategory({ name: "Đậu hũ", category: "Đồ chay" })).toEqual({ name: "Đậu hũ", category: "Đồ chay" });
  });
});
