import { describe, expect, it } from "vitest";
import {
  allergenLabels, expandRestrictedTerms, filterRecipesForProfile, findDietViolations, findRestrictedTerms, matchesRequiredDiet, normalizeDietTags,
  normalizeFoodText, prefersDiet,
} from "./dietary.service.js";

const recipe = (name: string, ingredients: string[], dietTags: Array<"BALANCED" | "VEGETARIAN" | "VEGAN" | "LOW_CARB" | "HIGH_PROTEIN"> = ["BALANCED"]) => ({
  name, dietTags, ingredients: ingredients.map((ingredientName) => ({ name: ingredientName })),
});

describe("normalizeFoodText", () => {
  it("ignores case and extra whitespace but keeps Vietnamese accents", () => {
    expect(normalizeFoodText("  Hải   SẢN ")).toBe("hải sản");
    expect(normalizeFoodText("Cá")).not.toBe(normalizeFoodText("Cà"));
  });
});

describe("allergy groups", () => {
  it.each([
    ["Hải sản", ["Tôm", "Cá lóc", "Mực ống", "Nước mắm"]],
    ["hải  sản", ["Cua"]],
    ["Sữa", ["Sữa tươi", "Sữa chua", "Phô mai feta", "Bơ lạt", "Sữa đặc"]],
    ["Trứng", ["Trứng", "Trứng vịt"]],
    ["Đậu phộng", ["Đậu phộng"]],
    ["Lạc", ["Lạc rang"]],
    ["Gluten", ["Bánh mì", "Mì Ý", "Bột mì"]],
  ])("%s excludes recipes containing %j", (allergy, ingredients) => {
    const terms = expandRestrictedTerms([allergy]);
    for (const ingredient of ingredients) {
      expect(findRestrictedTerms(recipe("Món thử", [ingredient]), terms)).not.toHaveLength(0);
    }
  });

  it.each([
    ["Sữa", "Sữa đậu nành"],
    ["Sữa", "Quả bơ"],
    ["Hải sản", "Cà chua"],
    ["Hải sản", "Bánh quốc"],
    ["Đậu phộng", "Đậu hũ"],
    ["Gluten", "Bún tươi"],
    ["Gluten", "Bánh phở"],
  ])("%s does not exclude the unrelated ingredient %s", (allergy, ingredient) => {
    expect(findRestrictedTerms(recipe("Món thử", [ingredient]), expandRestrictedTerms([allergy]))).toEqual([]);
  });

  it("matches a non-group allergy or disliked food as a whole word in the recipe name or ingredients", () => {
    const terms = expandRestrictedTerms(["  Cần TÂY ", "tôm"]);
    expect(findRestrictedTerms(recipe("Canh cần tây", ["Thịt bò"]), terms)).toEqual(["cần tây"]);
    expect(findRestrictedTerms(recipe("Canh bí đỏ nấu tôm", ["Bí đỏ"]), terms)).toEqual(["tôm"]);
    expect(findRestrictedTerms(recipe("Gà xào", ["Đùi gà"]), terms)).toEqual([]);
  });
});

describe("dị ứng theo nhóm: mọi cách gõ, ngoại lệ, chữ không nhận ra (sửa lỗi 13/11/2026)", () => {
  const hits = (allergy: string, ingredients: string[], name = "Món thử") =>
    findRestrictedTerms(recipe(name, ingredients), expandRestrictedTerms([allergy])).length > 0;

  it.each([
    ["trứng gà", "Trứng"], ["Trứng Gà", "Trứng"], ["trung ga", "Trứng"], ["dị ứng trứng", "Trứng"], ["egg", "Trứng"],
    ["lòng đỏ", "Trứng"], ["cá hồi", "Cá basa"], ["tôm sú", "Tôm"], ["lạc", "Đậu phộng"], ["đậu phộng", "Lạc rang"],
    ["sữa bò", "Sữa tươi"], ["sữa bò", "Phô mai feta"], ["sữa đậu nành", "Đậu hũ"], ["mè", "Dầu mè"], ["vừng", "Mè rang"],
  ])("hồ sơ %s lọc nguyên liệu %s", (allergy, ingredient) => expect(hits(allergy, [ingredient])).toBe(true));

  it("lọc cả theo tên món: \"trứng gà\" lọc Bánh mì ốp la (nguyên liệu Trứng)", () => {
    expect(hits("trứng gà", ["Bánh mì", "Trứng"], "Bánh mì ốp la")).toBe(true);
  });

  it.each([
    ["sữa bò", "Sữa đậu nành"], ["Sữa", "Sữa hạnh nhân"], ["Sữa", "Quả bơ"], ["Hải sản", "Cà chua"], ["cá", "Cà tím"],
    ["sữa đậu nành", "Sữa tươi"], ["đậu phộng", "Đậu hũ"], ["Đậu nành", "Cháo gà"],
  ])("ngoại lệ: %s không lọc %s", (allergy, ingredient) => expect(hits(allergy, [ingredient], ingredient)).toBe(false));

  it("\"Bơ lạt\" thuộc Sữa còn \"Quả bơ\" thì không", () => {
    expect(hits("Sữa", ["Bơ lạt"])).toBe(true);
    expect(hits("Sữa", ["Quả bơ"])).toBe(false);
  });

  it("chữ không thuộc nhóm nào vẫn lọc theo nguyên từ, hai chiều, gõ không dấu cũng được", () => {
    expect(hits("thịt bò xay", ["Thịt bò"])).toBe(true); // nguyên liệu nằm trong chữ người dùng gõ
    expect(hits("nấm", ["Nấm rơm"])).toBe(true);
    expect(hits("nam", ["Nấm rơm"])).toBe(true); // gõ không dấu → so không dấu
    expect(hits("nấm", ["Nam việt quất"])).toBe(false);
  });

  it("nhãn hiển thị \"nhóm (nguyên liệu)\" cho thẻ \"Chứa: …\"", () => {
    expect(allergenLabels(recipe("Bánh mì ốp la", ["Bánh mì", "Trứng", "Hành tây"]), ["trứng gà", "gluten"])).toEqual(["Trứng (Trứng)", "Gluten (Bánh mì)"]);
    expect(allergenLabels(recipe("Canh nấm", ["Nấm rơm"]), ["nấm"])).toEqual(["nấm (Nấm rơm)"]);
  });
});

describe("thành phần ẩn trong nguyên liệu chế biến (13/11/2026)", () => {
  const hits = (allergy: string, ingredients: string[], name = "Món thử") =>
    findRestrictedTerms(recipe(name, ingredients), expandRestrictedTerms([allergy])).length > 0;

  it.each([
    ["Đậu nành", "Nước tương"], ["Gluten", "Nước tương"], ["Gluten", "Xì dầu"], ["Đậu nành", "Tương đen"], ["Đậu nành", "Miso"],
    ["Đậu nành", "Tàu hũ ky"], ["Đậu nành", "Chao"], ["Hải sản", "Dầu hào"], ["Nhuyễn thể", "Dầu hào"], ["Giáp xác", "Mắm ruốc"],
    ["Giáp xác", "Mắm tôm"], ["Gluten", "Bột chiên giòn"], ["Gluten", "Mì"], ["Trứng", "Mayonnaise"], ["Sữa", "Bơ"], ["Sữa", "Kem"],
    ["Sữa", "Phô mai"], ["Mè", "Dầu mè"], ["Mè", "Muối mè"], ["Đậu phộng", "Bơ đậu phộng"],
    // "Có thể chứa" (tùy nhãn hàng) vẫn bị lọc khi dị ứng:
    ["Gluten", "Tương đen"], ["Gluten", "Dầu hào"], ["Gluten", "Tương ớt Hàn Quốc"], ["Mè", "Tương đen"], ["Đậu phộng", "Sa tế"],
  ])("dị ứng %s lọc %s", (allergy, ingredient) => expect(hits(allergy, [ingredient])).toBe(true));

  it.each([
    ["Gluten", "Bánh phở"], ["Gluten", "Bún tươi"], ["Gluten", "Bún gạo"], ["Gluten", "Mì chính"], ["Sữa", "Quả bơ"], ["Sữa", "Sinh tố bơ"],
    ["Sữa", "Bơ đậu phộng"], ["Sữa", "Sữa đậu nành"], ["Đậu nành", "Cháo gà"], ["Đậu nành", "Tương ớt"],
  ])("ngoại lệ giữ đúng: %s không lọc %s", (allergy, ingredient) => expect(hits(allergy, [ingredient], ingredient)).toBe(false));

  it("món không thích chỉ tránh nguyên liệu chắc chắn của nhóm, không tính \"có thể chứa\"", () => {
    expect(findRestrictedTerms(recipe("Gà xào", ["Tương đen"]), expandRestrictedTerms(["Gluten"], { strict: false }))).toEqual([]);
    expect(findRestrictedTerms(recipe("Gà xào", ["Nước tương"]), expandRestrictedTerms(["Gluten"], { strict: false }))).not.toEqual([]);
  });

  it("nhãn ghi nguồn: \"Đậu nành (Nước tương)\"; nhóm có thể chứa ghi tiền tố \"Có thể chứa\"", () => {
    expect(allergenLabels(recipe("Bò xào", ["Thịt bò", "Nước tương", "Tương đen"]), ["Đậu nành", "Gluten"]))
      .toEqual(["Đậu nành (Nước tương, Tương đen)", "Gluten (Nước tương)", "Có thể chứa Gluten (Tương đen)"]);
    expect(allergenLabels(recipe("Rau xào", ["Cải ngọt", "Dầu hào"]), ["Gluten"])).toEqual(["Có thể chứa Gluten (Dầu hào)"]);
  });
});

describe("diet rules", () => {
  it("requires vegetarian and vegan tags, and treats vegan dishes as vegetarian", () => {
    expect(matchesRequiredDiet(recipe("Gà", [], ["BALANCED"]), "VEGETARIAN")).toBe(false);
    expect(matchesRequiredDiet(recipe("Trứng", [], ["VEGETARIAN"]), "VEGETARIAN")).toBe(true);
    expect(matchesRequiredDiet(recipe("Đậu hũ", [], ["VEGAN"]), "VEGETARIAN")).toBe(true);
    expect(matchesRequiredDiet(recipe("Trứng", [], ["VEGETARIAN"]), "VEGAN")).toBe(false);
  });
  it("never filters out dishes for balanced, low-carb or high-protein users", () => {
    for (const dietType of ["BALANCED", "LOW_CARB", "HIGH_PROTEIN"] as const) {
      expect(matchesRequiredDiet(recipe("Cơm", [], ["BALANCED"]), dietType)).toBe(true);
    }
  });
  it("only prefers dishes for low-carb and high-protein users", () => {
    expect(prefersDiet(recipe("Bò", [], ["LOW_CARB"]), "LOW_CARB")).toBe(true);
    expect(prefersDiet(recipe("Bò", [], ["HIGH_PROTEIN"]), "HIGH_PROTEIN")).toBe(true);
    expect(prefersDiet(recipe("Cơm", [], ["BALANCED"]), "LOW_CARB")).toBe(false);
    expect(prefersDiet(recipe("Chay", [], ["VEGAN"]), "VEGAN")).toBe(false);
  });
  it("combines diet, allergies and disliked foods", () => {
    const recipes = [
      recipe("Đậu hũ sốt cà", ["Đậu hũ", "Cà chua"], ["VEGAN", "VEGETARIAN"]),
      recipe("Trứng chiên", ["Trứng"], ["VEGETARIAN"]),
      recipe("Canh chua chay", ["Đậu hũ", "Cần tây"], ["VEGAN", "VEGETARIAN"]),
      recipe("Cá kho", ["Cá basa"], ["BALANCED"]),
    ];
    const allowed = filterRecipesForProfile(recipes, { dietType: "VEGETARIAN", allergies: ["Trứng"], dislikedFoods: ["cần tây"] });
    expect(allowed.map((item) => item.name)).toEqual(["Đậu hũ sốt cà"]);
    expect(filterRecipesForProfile(recipes, null)).toHaveLength(4);
  });
});

describe("vegetarian / vegan labels (shared by seed data tests and the Admin recipe API)", () => {
  const withIngredients = (dietTags: Array<"BALANCED" | "VEGETARIAN" | "VEGAN">, names: string[]) => ({
    dietTags, ingredients: names.map((name) => ({ name })),
  });

  it("adds VEGETARIAN to a vegan dish and removes duplicate tags", () => {
    expect(normalizeDietTags(["VEGAN"])).toEqual(["VEGAN", "VEGETARIAN"]);
    expect(normalizeDietTags(["BALANCED", "BALANCED", "LOW_CARB"])).toEqual(["BALANCED", "LOW_CARB"]);
  });

  it("lists the meat, fish or fish sauce ingredients of a vegetarian dish", () => {
    expect(findDietViolations(withIngredients(["VEGETARIAN"], ["Đậu hũ", "Thịt heo xay", "Nước mắm", "Trứng"]))).toEqual([
      { ingredient: "Thịt heo xay", terms: ["thịt", "heo"], dietTag: "VEGETARIAN" },
      { ingredient: "Nước mắm", terms: ["nước mắm", "mắm"], dietTag: "VEGETARIAN" },
    ]);
  });

  it("also rejects milk, eggs and honey in a vegan dish", () => {
    expect(findDietViolations(withIngredients(["VEGAN", "VEGETARIAN"], ["Sữa tươi", "Trứng gà", "Mật ong", "Sữa đậu nành"]))
      .map((violation) => violation.ingredient)).toEqual(["Sữa tươi", "Trứng gà", "Mật ong"]);
  });

  it("accepts valid vegetarian dishes and ignores dishes without a vegetarian label", () => {
    expect(findDietViolations(withIngredients(["VEGETARIAN"], ["Đậu hũ", "Cà chua", "Nước tương", "Trứng"]))).toEqual([]);
    expect(findDietViolations(withIngredients(["BALANCED"], ["Thịt bò"]))).toEqual([]);
  });
});
